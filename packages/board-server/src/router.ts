/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";

import { serveContent } from "./server/common.js";
import { serveBoardsAPI } from "./server/boards/index.js";
import { serveProxyAPI } from "./server/proxy/index.js";
import { serveInfoAPI } from "./server/info/index.js";
import { serveHome } from "./server/home/index.js";

const handleError = (err: Error, res: ServerResponse) => {
  console.error("Server Error:", err);
  res.writeHead(500, { "Content-Type": "text/plain" });
  res.end("Internal Server Error");
};

export function makeRouter(hostname: string, vite: ViteDevServer | null) {
  return async function router(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    try {
      const url = new URL(req.url || "", hostname);

      if (await serveHome(req, res)) {
        return;
      }

      if (await serveProxyAPI(req, res)) {
        return;
      }

      if (await serveInfoAPI(req, res)) {
        return;
      }

      if (await serveBoardsAPI(url, vite, req, res)) {
        return;
      }

      serveContent(vite, req, res);
    } catch (err) {
      handleError(err as Error, res);
    }
  };
}
