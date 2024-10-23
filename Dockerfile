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
RUN adduser --system --uid 1001 nodejs
COPY --from=build /source/dist ./dist
COPY --from=build /source/package.json /source/package-lock.json ./
RUN npm ci
RUN npm install -g .
USER nodejs

CMD ["ffmpeg-s3"]
