/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from "http";
import packageInfo from "../../../package.json" with { type: "json" };

import { getStore } from "../store.js";

export const serveHome = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> => {
  // The "localhost" here isn't used for anything, it's just a placeholder to
  // help us parse the rest of the URL.
  const url = new URL(req.url ?? "", "http://localhost");
  if (url.pathname !== "/") {
    return false;
  }

  const store = getStore();
  const info = await store.getServerInfo();
  const title = info?.title ?? "Board Server";
  const description =
    info?.description ??
    `A server that hosts <a href="https://breadboard-ai.github.io/breadboard/">Breadboard</a> boards.`;
  res.end(`<!DOCTYPE html>
    <html>
      <head><title>${title}</title></head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <p>Version: ${packageInfo.version}</p>
      <script>
        const key = new URLSearchParams(window.location.search).get("API_KEY");
        if (key) {
          localStorage.setItem("board-server-key", key);
        }
      </script>
      </body>
    </html>`);
  return true;
};
