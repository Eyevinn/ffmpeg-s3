FROM node:20-alpine AS build
WORKDIR /source
COPY package.json package-lock.json ./
COPY . .
RUN npm ci
RUN npm run build

FROM alpine:3.19 AS runner
RUN apk update && apk upgrade
RUN apk --no-cache add curl
RUN apk --no-cache add nodejs npm
RUN apk --no-cache add aws-cli
RUN apk --no-cache add ffmpeg
RUN adduser --disabled-password --gecos '' --shell /bin/sh nodejs
COPY --from=build /source/dist ./dist
COPY --from=build /source/package.json /source/package-lock.json ./
COPY --from=build /source/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
RUN npm ci
RUN npm install -g .
VOLUME /usercontent
ENV STAGING_DIR=/usercontent

ENTRYPOINT [ "docker-entrypoint.sh" ]
CMD ["ffmpeg-s3"]
