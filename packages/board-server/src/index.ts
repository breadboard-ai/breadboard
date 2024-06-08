/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";
import { cors } from "./server/cors.js";
import { serveWithVite } from "./server/common.js";
import { serveBoardsAPI } from "./server/boards/index.js";

const PORT = env.PORT || 3000;
const HOST = env.HOST || "localhost";
const HOSTNAME = `http://${HOST}:${PORT}`;
const IS_PROD = env.NODE_ENV === "production";

const vite = IS_PROD
  ? null
  : await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
      optimizeDeps: { esbuildOptions: { target: "esnext" } },
    });

const server = createServer(async (req, res) => {
  if (!cors(req, res)) {
    return;
  }

  if (!(await serveBoardsAPI(vite, req, res))) {
    serveWithVite(vite, req, res);
  }
});

server.listen(PORT, () => {
  console.info(`Running on "${HOSTNAME}"...`);
});
