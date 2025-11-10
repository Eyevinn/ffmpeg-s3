import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import mv from 'mv';
import { splitCmdLineArgs, toLocalDir, toLocalFile, toUrl } from './util';

const DEFAULT_STAGING_DIR = '/tmp/data';

export interface FFmpegOptions {
  cmdString: string;
  stagingDir?: string;
  ffmpegExecutable?: string;
}

export async function doFFmpeg(opts: FFmpegOptions) {
  const stagingDir = await prepare(opts.stagingDir);
  if (!opts.cmdString) {
    throw new Error('No ffmpeg command string provided');
  }
  const { dest, actualCmdString, s3SegmentPattern } = await rewriteCmdString(
    opts.cmdString,
    stagingDir
  );
  console.log(`Output file: ${dest.toString()}`);
  console.log(`Staging directory: ${stagingDir}`);
  console.log(`Actual command string: ${actualCmdString}`);
  await runFFmpeg({ ...opts, actualCmdString, stagingDir });
  await uploadResult(dest, stagingDir, s3SegmentPattern);
}

export async function rewriteCmdString(
  cmdString: string,
  stagingDir: string
): Promise<{
  source: URL;
  dest: URL;
  actualCmdString: string;
  s3SegmentPattern?: string;
}> {
  const args = splitCmdLineArgs(cmdString);
  let output = '';
  let input;
  let s3SegmentPattern: string | undefined;
  const s3UrlReplacements: { [key: string]: string } = {};

  // Find input (-i flag)
  args.find((arg, i) => {
    if (arg === '-i' && i + 1 < args.length) {
      input = args[i + 1];
      return true; // Stop searching after finding the first input
    }
    return false;
  });
  if (!input) {
    throw new Error('No input file specified in ffmpeg command');
  }
  let inputUrl = toUrl(input);

  if (inputUrl.protocol === 's3:') {
    console.log(`Generating signed URL for S3 input: ${inputUrl.toString()}`);
    // Generate a signed URL for S3 input
    const { status, stdout, stderr } = spawnSync('aws', [
      's3',
      ...(process.env.S3_ENDPOINT_URL
        ? ['--endpoint-url', process.env.S3_ENDPOINT_URL]
        : []),
      'presign',
      inputUrl.toString(),
      '--expires-in',
      '21600' // 6 hour expiration
    ]);
    if (status !== 0) {
      console.error(`Failed to generate signed URL: ${stderr.toString()}`);
      throw new Error('Failed to generate signed URL');
    }
    inputUrl = new URL(stdout.toString().trim());
    s3UrlReplacements[input] = inputUrl.toString();
  }

  // First pass: identify HLS segment patterns
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (args[i - 1] === '-hls_segment_filename' && arg.startsWith('s3://')) {
      s3SegmentPattern = arg;
      break; // Found it, exit early
    }
  }

  // Second pass: process all S3 URLs with segment pattern knowledge
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check for HLS segment filename pattern
    if (args[i - 1] === '-hls_segment_filename' && arg.startsWith('s3://')) {
      // Replace the S3 segment pattern with a local pattern
      if (arg.includes('%v')) {
        // For variant streams, preserve directory structure
        const urlObj = toUrl(arg);
        const pathParts = urlObj.pathname.split('/');
        const relevantParts = pathParts.slice(-2); // Keep last 2 parts: stream_%v/segment_%03d.ts
        const localVariantPattern = relevantParts.join('/');
        s3UrlReplacements[arg] = localVariantPattern;
      } else {
        const localSegmentPattern = arg.split('/').pop() || 'segment_%03d.ts';
        s3UrlReplacements[arg] = localSegmentPattern;
      }
      continue;
    }

    if (arg.startsWith('s3://')) {
      // Skip if this is the input we already processed
      if (arg === input) continue;

      // For HLS workflows, if we have segments, treat all S3 outputs as local first
      if (s3SegmentPattern) {
        // For HLS variant streams, preserve directory structure
        if (arg.includes('%v')) {
          // Extract relative path from S3 URL for variant streams
          const urlObj = toUrl(arg);
          const pathParts = urlObj.pathname.split('/');
          const relevantParts = pathParts.slice(-2); // Keep last 2 parts: stream_%v/playlist.m3u8
          const localVariantPath = relevantParts.join('/');
          s3UrlReplacements[arg] = localVariantPath;
        } else {
          // Keep S3 URLs as local files for HLS workflows
          const localFileName = arg.split('/').pop() || 'output';
          s3UrlReplacements[arg] = localFileName;
        }
        continue;
      }

      const s3Url = toUrl(arg);
      console.log(`Generating signed URL for S3 argument: ${s3Url.toString()}`);

      const { status, stdout, stderr } = spawnSync('aws', [
        's3',
        ...(process.env.S3_ENDPOINT_URL
          ? ['--endpoint-url', process.env.S3_ENDPOINT_URL]
          : []),
        'presign',
        s3Url.toString(),
        '--expires-in',
        '21600' // 6 hour expiration
      ]);

      if (status !== 0) {
        console.error(
          `Failed to generate signed URL for ${arg}: ${stderr.toString()}`
        );
        throw new Error(`Failed to generate signed URL for ${arg}`);
      }

      s3UrlReplacements[arg] = stdout.toString().trim();
    }
  }

  // Find output (last argument that's not a flag)
  for (let i = args.length - 1; i >= 0; i--) {
    if (!args[i].startsWith('-')) {
      output = args[i];
      break;
    }
  }
  if (!output) {
    throw new Error('No output file specified in ffmpeg command');
  }
  const outputUrl = toUrl(output);

  // For HLS workflows, determine the appropriate local output
  let localOutputFile: string;
  if (s3SegmentPattern && output.startsWith('s3://')) {
    // For HLS variant streams, use the replacement mapping we already created
    localOutputFile = join(
      stagingDir,
      s3UrlReplacements[output] || toLocalFile(outputUrl)
    );
  } else {
    localOutputFile = join(stagingDir, toLocalFile(outputUrl));
  }

  // Apply all S3 URL replacements and output replacement
  let actualCmdString = cmdString;
  for (const [originalUrl, replacement] of Object.entries(s3UrlReplacements)) {
    actualCmdString = actualCmdString.replace(originalUrl, replacement);
  }
  actualCmdString = actualCmdString.replace(output, localOutputFile);

  return {
    source: inputUrl,
    dest: outputUrl,
    actualCmdString,
    s3SegmentPattern
  };
}

export async function prepare(
  stagingDir = DEFAULT_STAGING_DIR
): Promise<string> {
  const jobId = Math.random().toString(36).substring(7);
  const jobDir = join(stagingDir, jobId);
  if (!existsSync(jobDir)) {
    mkdirSync(jobDir, { recursive: true });
  }
  return jobDir;
}

async function moveFile(src: string, dest: string) {
  return new Promise((resolve, reject) => {
    mv(src, dest, (err) => (err ? reject(err) : resolve(dest)));
  });
}

export async function runFFmpeg(
  opts: FFmpegOptions & { actualCmdString: string; stagingDir: string }
) {
  const { actualCmdString, ffmpegExecutable, stagingDir } = opts;
  console.log(`cmdString: ${actualCmdString}`);
  const args = createFFmpegArgs(actualCmdString);
  const ffmpeg = ffmpegExecutable || 'ffmpeg';
  const { status, stderr, error } = spawnSync(ffmpeg, args, {
    cwd: stagingDir
  });
  if (status !== 0) {
    if (error) {
      console.error(`FFmpeg failed: ${error.message}`);
    } else {
      console.error(`FFmpeg failed with exit code ${status}`);
      console.error(stderr.toString());
    }
    throw new Error('FFmpeg failed');
  }
}

export function createFFmpegArgs(cmdString: string) {
  const cmdInputs: string[] = [];
  return cmdInputs.concat(splitCmdLineArgs(cmdString));
}

export async function uploadResult(
  dest: URL,
  stagingDir: string,
  s3SegmentPattern?: string
) {
  // For HLS workflows with segments, sync entire staging directory to S3
  if (s3SegmentPattern && dest.protocol === 's3:') {
    // Extract the base S3 path, removing variant stream directories and filenames
    let s3BasePath = s3SegmentPattern;

    // Remove the filename part (segment_%03d.ts)
    s3BasePath = s3BasePath.substring(0, s3BasePath.lastIndexOf('/') + 1);

    // If this is a variant stream path (contains %v), remove that directory level too
    if (s3BasePath.includes('%v')) {
      s3BasePath = s3BasePath.substring(
        0,
        s3BasePath.lastIndexOf('/', s3BasePath.length - 2) + 1
      );
    }

    const s3BaseUrl = toUrl(s3BasePath);

    console.log(`Syncing HLS output to ${s3BaseUrl.toString()}`);

    const { status, stderr } = spawnSync('aws', [
      's3',
      ...(process.env.S3_ENDPOINT_URL
        ? ['--endpoint-url', process.env.S3_ENDPOINT_URL]
        : []),
      'sync',
      stagingDir + '/',
      s3BaseUrl.toString()
    ]);

    if (status !== 0) {
      if (stderr) {
        console.log(stderr.toString());
      }
      throw new Error(`HLS sync failed: ${stderr.toString()}`);
    }

    console.log(`Successfully synced HLS output to ${s3BaseUrl.toString()}`);
    return;
  }

  // Handle non-HLS cases
  if (!dest.protocol || dest.protocol === 'file:') {
    if (dest.pathname.endsWith('/')) {
      await mkdir(toLocalDir(dest), { recursive: true });
      const files = await readdir(stagingDir);
      await Promise.all(
        files.map((file) =>
          moveFile(join(stagingDir, file), join(dest.pathname, file))
        )
      );
    } else {
      const fileName = dest.pathname.split('/').pop() || '';
      const files = await readdir(stagingDir);
      const file = files.find((f) => f === fileName);

      if (!file) {
        throw new Error(
          `Output file ${fileName} not found in staging directory`
        );
      }

      // Ensure target directory exists
      await mkdir(dirname(dest.pathname), { recursive: true });
      await moveFile(join(stagingDir, file), dest.pathname);
    }
    return;
  }

  if (dest.protocol === 's3:') {
    if (dest.pathname.endsWith('/')) {
      const { status, stderr } = spawnSync('aws', [
        's3',
        ...(process.env.S3_ENDPOINT_URL
          ? ['--endpoint-url', process.env.S3_ENDPOINT_URL]
          : []),
        'cp',
        '--recursive',
        stagingDir,
        new URL(dirname(dest.pathname), dest).toString()
      ]);
      if (status !== 0) {
        if (stderr) {
          console.log(stderr.toString());
        }
        throw new Error('Upload failed');
      }
      console.log(`Uploaded package to ${dest.toString()}`);
    } else {
      const fileName = dest.pathname.split('/').pop() || '';
      const files = await readdir(stagingDir);
      const file = files.find((f) => f === fileName);

      if (!file) {
        throw new Error(
          `Output file ${fileName} not found in staging directory`
        );
      }

      const localFilePath = join(stagingDir, file);
      const { status, stderr } = spawnSync('aws', [
        's3',
        ...(process.env.S3_ENDPOINT_URL
          ? ['--endpoint-url', process.env.S3_ENDPOINT_URL]
          : []),
        'cp',
        localFilePath,
        dest.toString()
      ]);
      if (status !== 0) {
        if (stderr) {
          console.log(stderr.toString());
        }
        throw new Error(`Upload failed: ${stderr.toString()}`);
      }
      console.log(`Uploaded ${dest.toString()}`);
    }
  } else {
    throw new Error(`Unsupported protocol for upload: ${dest.protocol}`);
  }
}
