FROM node:lts
WORKDIR /breadboard

# This file uses a named context that points to the root of the monorepo. It
# must be supplied using the --build-context flag:
#
# docker build build-context=breadboard=../.. .
COPY --from=breadboard / .

RUN npm install --save-dev

WORKDIR packages/unified-server
RUN npm run build

ENV NODE_ENV="production"
EXPOSE 3000

CMD ["node", "dist/src/server/main.js"]
