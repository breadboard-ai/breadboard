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

export function makeRouter(hostname: string, vite: ViteDevServer | null) {
  return async function router(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
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
  };
}
