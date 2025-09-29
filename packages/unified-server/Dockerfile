FROM node:20-slim
WORKDIR /breadboard

# This file uses a named context that points to the root of the monorepo.
# https://docs.docker.com/build/concepts/context/#named-contexts
#
# It must be supplied using the --build-context flag when building the image:
# build-context=breadboard=../.. .
COPY --from=breadboard / .

RUN npm clean-install

ARG VITE_BOARD_SERVICE="drive:"

# TODO Turn these into runtime vars
ARG VITE_GOOGLE_DRIVE_PUBLISH_PERMISSIONS
ARG VITE_VALID_REDIRECT_URI_ORIGINS
ARG VITE_ENVIRONMENT_NAME

WORKDIR packages/unified-server
RUN npm run build

# Run-time vars
ENV NODE_ENV="production"
ENV FIRESTORE_DB_NAME="unified-server"

EXPOSE 3000

CMD ["node", "dist/src/server/main.js"]
