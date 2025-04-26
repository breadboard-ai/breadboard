FROM node:20-slim
WORKDIR /breadboard

# This file uses a named context that points to the root of the monorepo.
# https://docs.docker.com/build/concepts/context/#named-contexts
#
# It must be supplied using the --build-context flag when building the image:
# build-context=breadboard=../.. .
COPY --from=breadboard / .

RUN npm clean-install

WORKDIR packages/unified-server
RUN npm run build

ENV CONNECTIONS_FILE="/breadboard/packages/unified-server/secrets/secrets.json"
ENV NODE_ENV="production"
ENV FIRESTORE_DB_NAME="unified-server"

EXPOSE 3000

CMD ["node", "dist/src/server/main.js"]
