FROM node:20-slim
WORKDIR /breadboard

# This file uses a named context that points to the root of the monorepo.
# https://docs.docker.com/build/concepts/context/#named-contexts
#
# It must be supplied using the --build-context flag when building the image:
# build-context=breadboard=../.. .
COPY --from=breadboard / .

RUN npm clean-install

ARG STORAGE_BUCKET
ARG SERVER_URL
ARG VITE_BOARD_SERVICE
ARG VITE_GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID
ARG VITE_GOOGLE_DRIVE_PUBLISH_PERMISSIONS
ARG VITE_GOOGLE_DRIVE_USER_FOLDER_NAME
ARG VITE_VALID_REDIRECT_URI_ORIGINS
ARG VITE_ENVIRONMENT_NAME

# Built-time vars
ENV VITE_BOARD_SERVICE=${VITE_BOARD_SERVICE:-/board/}

WORKDIR packages/unified-server
RUN npm run build

# Run-time vars
ENV CONNECTIONS_FILE="/breadboard/packages/unified-server/secrets/secrets.json"
ENV NODE_ENV="production"
ENV FIRESTORE_DB_NAME="unified-server"
ENV STORAGE_BUCKET=${STORAGE_BUCKET}
ENV SERVER_URL=${SERVER_URL}

EXPOSE 3000

CMD ["node", "dist/src/server/main.js"]
