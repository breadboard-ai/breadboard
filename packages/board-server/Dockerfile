# Build stage
FROM node:20 AS build
WORKDIR /build

# Copy the entire monorepo
COPY --from=breadboard / ./

# Install ALL dependencies, including devDependencies
RUN npm ci

# Build the project
WORKDIR /build/packages/board-server
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV STORAGE_BACKEND="sqlite"
ENV GOOGLE_CLOUD_PROJECT="n/a"
ENV ALLOWED_ORIGINS=""

# Copy necessary files from the build stage
COPY --from=build /build/packages/board-server/dist ./dist
COPY --from=build /build/packages/board-server/src ./src
COPY --from=build /build/packages/board-server/package.json ./
COPY --from=build /build/packages/board-server/public ./public
COPY --from=build /build/packages/board-server/scripts ./scripts
COPY --from=build /build/packages/board-server/tsconfig.json ./

# Install production dependencies and tsx
RUN npm install --only=production && \
    npm install -g tsx

EXPOSE 3000
CMD ["node", "dist/server/index.js"]