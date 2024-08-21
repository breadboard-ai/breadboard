/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";

import { makeRouter } from "./router.js";

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

const server = createServer(makeRouter(HOSTNAME, vite));

server.listen(PORT, () => {
  console.info(`Running on "${HOSTNAME}"...`);
});
