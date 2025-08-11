/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { getUserCredentials, requireAuth } from "@breadboard-ai/board-server";
import { McpProxyRequest } from "@breadboard-ai/mcp";
import cors from "cors";
import { Request, Response, Router } from "express";
import { Readable } from "node:stream";

export { createMcpProxyHandler };

function createMcpProxyHandler() {
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );
  router.use(getUserCredentials());
  router.post("/", requireAuth(), async (req: Request, res: Response) => {
    const request = req.body as McpProxyRequest;
    // TODO: Validate the request.
    try {
      const response = await fetch(request.url, request.init);
      res.status(response.status);
      response.headers.forEach((value, name) => {
        res.setHeader(name, value);
      });
      if (response.body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }

      // stream response back to the res
    } catch (e) {
      res.status(500).send((e as Error).message);
    }
  });
  return router;
}
