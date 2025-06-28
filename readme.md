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

[![Badge OSC](https://img.shields.io/badge/Evaluate-24243B?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyKSIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI3IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz4KPGRlZnM%2BCjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8yODIxXzMxNjcyIiB4MT0iMTIiIHkxPSIwIiB4Mj0iMTIiIHkyPSIyNCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjQzE4M0ZGIi8%2BCjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzREQzlGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM%2BCjwvc3ZnPgo%3D)](https://app.osaas.io/browse/eyevinn-ffmpeg-s3)

## Requirements

ffmpeg executable must be available in path under the name `ffmpeg`. When using S3 for output the AWS CLI must be installed and configured,.

## Installation / Usage

### Eyevinn Open Source Cloud

Install the OSC command line tool (0.15.3+):

```
% npm install -g @osaas/cli
```

Repackage the content from HLS to a MP4 container.

```
% export OSC_ACCESS_TOKEN=<personal-access-token>
% osc create eyevinn-ffmpeg-s3 demo \
  -o awsAccessKeyId="{{secrets.awsaccesskeyid}}" \
  -o awsAccessKeyId="{{secrets.awssecretaccesskey}} \
  -o cmdLineArgs="-i https://maitv-vod.lab.eyevinn.technology/VINN.mp4/master.m3u8 -c:v -c:a copy s3://lab-testcontent-output/demo/vinn.mp4"
```

Repackage content from MP4 to a MOV container where the source is on S3.

```
% osc create eyevinn-ffmpeg-s3 demo \
  -o awsAccessKeyId="{{secrets.awsaccesskeyid}}" \
  -o awsSecretAccessKey="{{secrets.awssecretaccesskey}}" \
  -o cmdLineArgs="-i s3://lab-testcontent-input/NO_TIME_TO_DIE_short_Trailer_2021.mp4 -c:v copy -c:a copy s3://lab-testcontent-output/demo/trailer.mov"
```

Extract first 30 seconds of a video.

```
% osc create eyevinn-ffmpeg-s3 demo \
  -o awsAccessKeyId="{{secrets.awsaccesskeyid}}" \
  -o awsSecretAccessKey="{{secrets.awssecretaccesskey}}" \
  -o cmdLineArgs="-i s3://lab-testcontent-input/NO_TIME_TO_DIE_short_Trailer_2021.mp4 -ss 0 -t 30 -c:v copy -c:a copy s3://lab-testcontent-output/demo/trailer-30sec.mov"
```


### CLI

```
% npm install -g ffmpeg-s3
```

Repackage the content from MP4 to a MOV container

```
% export AWS_ACCESS_KEY_ID=<aws-access-key-id>
% export AWS_SECRET_ACCESS_KEY=<aws-secret-access-key>
% ffmpeg-s3 -i https://lab-testcontent-input.s3.eu-north-1.amazonaws.com/NO_TIME_TO_DIE_short_Trailer_2021.mp4?SIGNED_URL -c:v copy -c:a copy s3://lab-testcontent-output/demo/trailer.mov
```

### Library

```javascript
import { doFFmpeg } from '@eyevinn/ffmpeg-s3';

doFFMpeg({
  cmdString: '-i s3://lab-testcontent-input/NO_TIME_TO_DIE_short_Trailer_2021.mp4 -c:v copy -c:a copy s3://lab-testcontent-output/demo/trailer.mov'
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
  ffmpeg-s3:local -i s3://lab-testcontent-input/NO_TIME_TO_DIE_short_Trailer_2021.mp4 c:v copy c:a copy s3://lab-testcontent-output/demo/trailer.mov
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
