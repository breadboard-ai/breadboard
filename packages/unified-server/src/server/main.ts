import express from "express";
import ViteExpress from "vite-express";

import {
  createServer,
  loadConnections,
} from "@breadboard-ai/connection-server/server.js";
import {
  makeRouter,
  createServerConfig,
} from "@breadboard-ai/board-server/router";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

const app = express();

const configPath = process.env.CONNECTIONS_FILE;
const connections = configPath ? await loadConnections(configPath) : new Map();

app.use("/connection", createServer({ connections, allowedOrigins: [] }));

const config = createServerConfig(ROOT_PATH, null);

app.use("/board", makeRouter(config));

ViteExpress.listen(app, config.port, () => {
  console.log(`Unified server at: http://localhost:${config.port}`);
});
