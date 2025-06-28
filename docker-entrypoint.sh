#!/bin/sh

STAGING_DIR=${STAGING_DIR:-/usercontent}
chown nodejs -R $STAGING_DIR 
chmod 777 $STAGING_DIR

# Switch to the nodejs user
su - nodejs
if [ $1 = "ffmpeg-s3" ]; then
  shift
fi
ffmpeg-s3 "$@"