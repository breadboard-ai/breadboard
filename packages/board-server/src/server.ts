/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer, Server } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";
import { createServerConfig, makeRouter } from "./router.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

export const startServer = async (rootPath: string = ROOT_PATH) => {
  const isProd = env.NODE_ENV === "production";
  const viteDevServer = isProd
    ? null
    : await createViteServer({
        server: { middlewareMode: true },
        appType: "custom",
        optimizeDeps: { esbuildOptions: { target: "esnext" } },
      });

  const serverConfig = createServerConfig(rootPath, viteDevServer);

  const server = createServer(makeRouter(serverConfig));

  return new Promise<{ server: Server; port: string | number }>(
    (resolve, reject) => {
      server.listen(serverConfig.port, () => {
        console.info(`Running on "${serverConfig.hostname}"...`);
        resolve({ server, port: serverConfig.port });
      });

      server.on("error", (error) => {
        reject(error);
      });
    }
  );
};

export const stopServer = (server: Server) => {
  return new Promise<void>((resolve, reject) => {
    server.close((err: Error | undefined) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
