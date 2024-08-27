FROM node:20
COPY --from=breadboard . /breadboard/
# For the time being, we will assume container deployments are exclusively sqlite.
ENV STORAGE_BACKEND "sqlite"
ENV GOOGLE_CLOUD_PROJECT "n/a"
WORKDIR /breadboard
RUN npm ci
WORKDIR /breadboard/packages/board-server
RUN npm run build
CMD ["npm", "run", "serve", "--", "--host=0.0.0.0"]