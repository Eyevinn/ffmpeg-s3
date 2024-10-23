<div align="center">
<br />

[![npm](https://img.shields.io/npm/v/@eyevinn/ffmpeg-s3?style=flat-square)](https://www.npmjs.com/package/@eyevinn/ffmpeg-s3)
[![github release](https://img.shields.io/github/v/release/Eyevinn/ffmpeg-s3?style=flat-square)](https://github.com/Eyevinn/ffmpeg-s3/releases)
[![license](https://img.shields.io/github/license/eyevinn/ffmpeg-s3.svg?style=flat-square)](LICENSE)

[![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg?style=flat-square)](https://github.com/eyevinn/ffmpeg-s3/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
[![made with hearth by Eyevinn](https://img.shields.io/badge/made%20with%20%E2%99%A5%20by-Eyevinn-59cbe8.svg?style=flat-square)](https://github.com/eyevinn)
[![Slack](http://slack.streamingtech.se/badge.svg)](http://slack.streamingtech.se)

</div>

# ffmpeg-s3

CLI and library for running ffmpeg and output result to an S3 bucket.

## Requirements

ffmpeg executable must be available in path under the name `ffmpeg`. When using S3 for output the AWS CLI must be installed and configured,.

## Installation / Usage

### CLI

```
% npm install -g ffmpeg-s3
```

Repackage the content from MP4 to a MOV container

```
% export AWS_ACCESS_KEY_ID=<aws-access-key-id>
% export AWS_SECRET_ACCESS_KEY=<aws-secret-access-key>
% ffmpeg-s3 -i https://lab-testcontent-input.s3.eu-north-1.amazonaws.com/NO_TIME_TO_DIE_short_Trailer_2021.mp4?SIGNED_URL -d s3://lab-testcontent-output/demo/trailer.mov "-c:v copy -c:a copy"
```

### Library

```javascript
import { doFFmpeg } from '@eyevinn/ffmpeg-s3';

doFFMpeg({
  dest: 's3://lab-testcontent-output/demo/trailer.mov',
  cmdString: '-c:v copy -c:a copy',
  source:
    'https://lab-testcontent-input.s3.eu-north-1.amazonaws.com/NO_TIME_TO_DIE_short_Trailer_2021.mp4?SIGNED_URL'
})
  .then(() => {
    console.log('done and uploaded');
  })
  .catch((err) => {
    console.error(err);
  });
```

### Docker

```
docker build -t ffmpeg-s3:local .
```

```
docker run --rm \
  -e AWS_ACCESS_KEY_ID=<aws-access-key-id> \
  -e AWS_SECRET_ACCESS_KEY=<aws-secret-access-key> \
  ffmpeg-s3:local \
  ffmpeg-s3 \
  -i https://lab-testcontent-input.s3.eu-north-1.amazonaws.com/NO_TIME_TO_DIE_short_Trailer_2021.mp4?SIGNED_URL \
  -d s3://lab-testcontent-output/demo/trailer.mov \
  -- "c:v copy c:a copy"
```

## Development

Prerequisites:

- ffmpeg
- AWS cli

Run script locally

```
% npm run build
% node dist/cli.js -h
```

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md)

## License

This project is licensed under the MIT License, see [LICENSE](LICENSE).

# Support

Join our [community on Slack](http://slack.streamingtech.se) where you can post any questions regarding any of our open source projects. Eyevinn's consulting business can also offer you:

- Further development of this component
- Customization and integration of this component into your platform
- Support and maintenance agreement

Contact [sales@eyevinn.se](mailto:sales@eyevinn.se) if you are interested.

# About Eyevinn Technology

[Eyevinn Technology](https://www.eyevinntechnology.se) is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor. As our way to innovate and push the industry forward we develop proof-of-concepts and tools. The things we learn and the code we write we share with the industry in [blogs](https://dev.to/video) and by open sourcing the code we have written.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!
