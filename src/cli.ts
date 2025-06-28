#! /usr/bin/env node

import { doFFmpeg } from './ffmpeg';
import { stripQuotes } from './util';

async function main(args: string[]) {
  try {
    const cmdString = stripQuotes(args.join(' ')).trim();
    console.log('Running ffmpeg with command:', cmdString);
    await doFFmpeg({
      cmdString,
      stagingDir: process.env.STAGING_DIR || '/tmp/data',
      ffmpegExecutable: process.env.FFMPEG_EXECUTABLE
    });
  } catch (err) {
    console.log((err as Error).message);
  }
}

main(process.argv.slice(2));
