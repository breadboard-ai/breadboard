FROM node:24-slim
WORKDIR /breadboard

COPY / .
RUN npm clean-install

ENV NODE_ENV="production"
ARG VITE_BOARD_SERVICE="drive:"

WORKDIR packages/unified-server
RUN npm run build

CMD ["node", "dist/src/main.js"]
