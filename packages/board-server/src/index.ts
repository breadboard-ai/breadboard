/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";
import { cors } from "./server/cors.js";
import { serveContent } from "./server/common.js";
import { serveBoardsAPI } from "./server/boards/index.js";
import { serveProxyAPI } from "./server/proxy/index.js";
import { serveInfoAPI } from "./server/info/index.js";

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
  const url = new URL(req.url || "", HOSTNAME);

  if (await serveProxyAPI(req, res)) {
    return;
  }

  if (!cors(req, res)) {
    return;
  }

  if (await serveInfoAPI(req, res)) {
    return;
  }

  if (await serveBoardsAPI(url, vite, req, res)) {
    return;
  }

  serveContent(vite, req, res);
});

server.listen(PORT, () => {
  console.info(`Running on "${HOSTNAME}"...`);
});
