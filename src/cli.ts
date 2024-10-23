#! /usr/bin/env node

import { Command } from 'commander';
import { doFFmpeg } from './ffmpeg';
import { stripQuotes } from './util';

const cli = new Command();
cli
  .description(`Run ffmpeg and output to S3 or local`)
  .option('-i, --input <input>', 'Input URL')
  .option(
    '--staging-dir <stagingDir>',
    'Staging directory (default: /tmp/data)'
  )
  .option(
    '--ffmpeg-executable <ffmpegExecutable>',
    'Path to ffmpeg executable (default: ffmpeg)'
  )
  .option(
    '-d, --destination <dest>',
    'Destination file URL (supported protocols: s3, local file)'
  )
  .argument('<ffmpegCmdString>', 'ffmpeg command string')
  .action(async (ffmpegCmdString, options) => {
    try {
      console.log('Running ffmpeg');
      console.log(`dest: ${options.destination}, source: ${options.input}`);
      await doFFmpeg({
        dest: options.destination || '.',
        cmdString: stripQuotes(ffmpegCmdString),
        source: options.input,
        stagingDir: options.stagingDir,
        ffmpegExecutable:
          options.ffmpegExecutable || process.env.FFMPEG_EXECUTABLE
      });
    } catch (err) {
      console.log((err as Error).message);
    }
  });

cli.parseAsync(process.argv);
