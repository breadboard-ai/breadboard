/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { grant } from "./api/grant.js";
import { list } from "./api/list.js";
import { refresh } from "./api/refresh.js";
import type { Config } from "./config.js";
import { cors } from "./cors.js";
import { internalServerError, notFound } from "./responses.js";

export function makeRouter(config: Config) {
  return async function router(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    if (!cors(req, res)) {
      return;
    }
    try {
      const path = new URL(req.url ?? "", "http://example.com").pathname;
      switch (path) {
        case "/list": {
          return await list(req, res, config);
        }
        case "/grant": {
          return await grant(req, res, config);
        }
        case "/refresh": {
          return await refresh(req, res, config);
        }
        default: {
          return notFound(res, `Page "${path}" does not exist`);
        }
      }
    } catch (err) {
      console.error(
        err instanceof Error ? err.stack ?? err.message : String(err)
      );
      return internalServerError(res, `Uncaught exception`);
    }
  };
}
