FROM node:20-alpine

RUN apk update && \
    apk add --no-cache git ffmpeg
COPY package.json .
RUN npm install --legacy-peer-deps
RUN npm i libphonenumber-js countries-and-timezones moment-timezone
COPY . .
EXPOSE 8080

CMD ["npm", "start"]
