/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import { env } from "process";
import { makeRouter } from "./router.js";

export const startServer = async () => {
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

  return new Promise<{ server: any; port: string | number }>((resolve, reject) => {
    server.listen(PORT, () => {
      console.info(`Running on "${HOSTNAME}"...`);
      resolve({ server, port: PORT });
    });

    server.on("error", (error) => {
      reject(error);
    });
  });
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