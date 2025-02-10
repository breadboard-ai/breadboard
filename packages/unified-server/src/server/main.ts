import express from "express";
import ViteExpress from "vite-express";

import { createServer } from "@breadboard-ai/connection-server/server.js";
import {
  makeRouter,
  createServerConfig,
} from "@breadboard-ai/board-server/router";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

const app = express();

app.use(
  "/connection",
  createServer({
    connections: new Map(),
    allowedOrigins: [],
  })
);

const config = createServerConfig(ROOT_PATH, null);

app.use("/board", makeRouter(config));

ViteExpress.listen(app, config.port, () => {
  console.log(`Server is listening on port ${config.port}`);
});
