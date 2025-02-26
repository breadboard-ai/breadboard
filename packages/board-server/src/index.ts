/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

import { createServer, createServerConfig } from "./server.js";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

try {
  // TODO move this into createServerConfig?
  const viteDevServer =
    process.env.NODE_ENV === "production"
      ? undefined
      : await createViteServer({
          server: { middlewareMode: true },
          appType: "custom",
          optimizeDeps: { esbuildOptions: { target: "esnext" } },
        });

  const config = createServerConfig(ROOT_PATH, viteDevServer);
  const server = createServer(config);

  server.listen(config.port);
} catch (err) {
  console.error("Failed to start the server", err);
  process.exit(1);
}
