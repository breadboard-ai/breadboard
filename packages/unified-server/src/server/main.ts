import express from "express";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import ViteExpress from "vite-express";

import * as connectionServer from "@breadboard-ai/connection-server/server.js";
import * as boardServer from "@breadboard-ai/board-server";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

const server = express();

const configPath = process.env.CONNECTIONS_FILE;
const connections = configPath
  ? await connectionServer.loadConnections(configPath)
  : new Map();

const boardServerConfig = boardServer.createServerConfig(ROOT_PATH);

server.use("/board", boardServer.createServer(boardServerConfig));
server.use(
  "/connection",
  connectionServer.createServer({ connections, allowedOrigins: [] })
);

ViteExpress.static({
  enableBrotli: true,
});

ViteExpress.listen(server, boardServerConfig.port, () => {
  console.log(`Unified server at: http://localhost:${boardServerConfig.port}`);
});
