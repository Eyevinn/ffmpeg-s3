#! /usr/bin/env node

import { Command } from 'commander';
import { doFFmpeg } from './ffmpeg';
import { stripQuotes } from './util';

/*
const cli = new Command();
cli
  .description(`Run ffmpeg and output to S3 or local`)
  .option(
    '--staging-dir <stagingDir>',
    'Staging directory (default: /tmp/data)'
  )
  .option(
    '--ffmpeg-executable <ffmpegExecutable>',
    'Path to ffmpeg executable (default: ffmpeg)'
  )
  .argument('<ffmpegCmdString>', 'ffmpeg command string')
  .action(async (ffmpegCmdString, options) => {
    try {
      console.log('Running ffmpeg');
      await doFFmpeg({
        cmdString: stripQuotes(ffmpegCmdString),
        stagingDir: options.stagingDir,
        ffmpegExecutable:
          options.ffmpegExecutable || process.env.FFMPEG_EXECUTABLE
      });
    } catch (err) {
      console.log((err as Error).message);
    }
  });

cli.parseAsync(process.argv);

*/

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
