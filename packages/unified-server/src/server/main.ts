import express from "express";
import ViteExpress from "vite-express";

import {
  createServer,
  loadConnections,
} from "@breadboard-ai/connection-server/server.js";
import {
  createServer as createBoardServer,
  createServerConfig as createBoardServerConfig,
} from "@breadboard-ai/board-server";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

const app = express();

const configPath = process.env.CONNECTIONS_FILE;
const connections = configPath ? await loadConnections(configPath) : new Map();

app.use("/connection", createServer({ connections, allowedOrigins: [] }));

const boardServerConfig = createBoardServerConfig(ROOT_PATH);

app.use("/board", createBoardServer(boardServerConfig));

ViteExpress.static({
  enableBrotli: true,
});

ViteExpress.listen(app, boardServerConfig.port, () => {
  console.log(`Unified server at: http://localhost:${boardServerConfig.port}`);
});
