FROM node:20-slim
WORKDIR /breadboard

# This file uses a named context that points to the root of the monorepo.
# https://docs.docker.com/build/concepts/context/#named-contexts
#
# It must be supplied using the --build-context flag when building the image:
# build-context=breadboard=../.. .
COPY --from=breadboard / .

RUN npm clean-install

ARG VITE_BOARD_SERVICE
ARG VITE_GOOGLE_DRIVE_PUBLIC_API_KEY
ARG VITE_GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID
ARG VITE_GOOGLE_DRIVE_PUBLISH_PERMISSIONS
ARG VITE_GOOGLE_DRIVE_USER_FOLDER_NAME
ARG VITE_FEEDBACK_LINK

# Built-time vars
ENV VITE_BOARD_SERVICE=${VITE_BOARD_SERVICE:-/board/}

WORKDIR packages/unified-server
RUN npm run build

# Run-time vars
ENV CONNECTIONS_FILE="/breadboard/packages/unified-server/secrets/secrets.json"
ENV NODE_ENV="production"
ENV FIRESTORE_DB_NAME="unified-server"
ENV VITE_GOOGLE_DRIVE_PUBLIC_API_KEY=${VITE_GOOGLE_DRIVE_PUBLIC_API_KEY}

EXPOSE 3000

CMD ["node", "dist/src/server/main.js"]
