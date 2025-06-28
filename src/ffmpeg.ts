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
  const { dest, actualCmdString } = await rewriteCmdString(
    opts.cmdString,
    stagingDir
  );
  console.log(`Output file: ${dest.toString()}`);
  console.log(`Staging directory: ${stagingDir}`);
  console.log(`Actual command string: ${actualCmdString}`);
  await runFFmpeg({ ...opts, actualCmdString, stagingDir });
  await uploadResult(dest, stagingDir);
}

export async function rewriteCmdString(
  cmdString: string,
  stagingDir: string
): Promise<{ source: URL; dest: URL; actualCmdString: string }> {
  const args = splitCmdLineArgs(cmdString);
  let output = '';
  let input;

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
  const localOutputFile = join(stagingDir, toLocalFile(outputUrl));
  const actualCmdString = cmdString
    .replace(input, inputUrl.toString())
    .replace(output, localOutputFile);
  return { source: inputUrl, dest: outputUrl, actualCmdString };
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

export async function uploadResult(dest: URL, stagingDir: string) {
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
      await moveFile(join(stagingDir, file || ''), dest.pathname);
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
      const { status, stderr } = spawnSync('aws', [
        's3',
        ...(process.env.S3_ENDPOINT_URL
          ? ['--endpoint-url', process.env.S3_ENDPOINT_URL]
          : []),
        'cp',
        join(stagingDir, file || ''),
        dest.toString()
      ]);
      if (status !== 0) {
        if (stderr) {
          console.log(stderr.toString());
        }
        throw new Error('Upload failed');
      }
    }
  } else {
    throw new Error(`Unsupported protocol for upload: ${dest.protocol}`);
  }
}
