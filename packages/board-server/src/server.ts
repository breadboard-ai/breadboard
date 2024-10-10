/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";
import { makeRouter } from "./router.js";
import type { ServerConfig } from "./server/config.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

export const startServer = async (rootPath: string = ROOT_PATH) => {
  const PORT = env.PORT || 3000;
  const HOST = env.HOST || "localhost";
  const HOSTNAME = `http://${HOST}:${PORT}`;
  const IS_PROD = env.NODE_ENV === "production";

  const storageBucket = env["STORAGE_BUCKET"] || undefined;

  const serverConfig: ServerConfig = {
    allowedOrigins: new Set(
      (process.env["ALLOWED_ORIGINS"] ?? "")
        .split(/\s+/)
        .filter((origin) => origin !== "")
    ),
    hostname: HOSTNAME,
    serverUrl: env["SERVER_URL"],
    viteDevServer: IS_PROD
      ? null
      : await createViteServer({
          server: { middlewareMode: true },
          appType: "custom",
          optimizeDeps: { esbuildOptions: { target: "esnext" } },
        }),
    rootPath,
    storageBucket,
  };

  const server = createServer(makeRouter(serverConfig));

  return new Promise<{ server: any; port: string | number }>(
    (resolve, reject) => {
      server.listen(PORT, () => {
        console.info(`Running on "${HOSTNAME}"...`);
        resolve({ server, port: PORT });
      });

      server.on("error", (error) => {
        reject(error);
      });
    }
  );
};

export const stopServer = (server: any) => {
  return new Promise<void>((resolve, reject) => {
    server.close((err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
