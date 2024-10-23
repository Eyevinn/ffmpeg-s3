import { join, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import mv from 'mv';
import { splitCmdLineArgs, toLocalDir, toLocalFile, toUrl } from './util';

const DEFAULT_STAGING_DIR = '/tmp/data';

export interface FFmpegOptions {
  source: string;
  cmdString: string;
  dest: string;
  stagingDir?: string;
  ffmpegExecutable?: string;
}

export async function doFFmpeg(opts: FFmpegOptions) {
  const stagingDir = await prepare(opts.stagingDir);
  await runFFmpeg({ ...opts, stagingDir });
  await uploadResult(toUrl(opts.dest), stagingDir);
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

export async function runFFmpeg(opts: FFmpegOptions & { stagingDir: string }) {
  const { source, dest, cmdString, ffmpegExecutable, stagingDir } = opts;
  const destUrl = toUrl(dest);
  const args = createFFmpegArgs(source, cmdString, toLocalFile(destUrl));
  console.log(args);
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

export function createFFmpegArgs(
  source: string,
  cmdString: string,
  destFilename: string
) {
  const cmdInputs: string[] = [];
  cmdInputs.push('-i', source);
  return cmdInputs.concat(splitCmdLineArgs(cmdString), destFilename);
}

export async function uploadResult(dest: URL, stagingDir: string) {
  if (!dest.protocol || dest.protocol === 'file:') {
    await mkdir(toLocalDir(dest), { recursive: true });
    const files = await readdir(stagingDir);
    await Promise.all(
      files.map((file) =>
        moveFile(join(stagingDir, file), join(dest.pathname, file))
      )
    );
    return;
  }
  if (dest.protocol === 's3:') {
    const { status, stderr } = spawnSync('aws', [
      's3',
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
    throw new Error(`Unsupported protocol for upload: ${dest.protocol}`);
  }
}
