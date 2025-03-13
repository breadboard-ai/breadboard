/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import packageInfo from "../../../package.json" with { type: "json" };
import { getStore } from "../store.js";

export const serveHome = async (_req: Request, res: Response) => {
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
      </body>
    </html>`);
};
