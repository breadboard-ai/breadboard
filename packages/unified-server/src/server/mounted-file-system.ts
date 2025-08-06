/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  composeFileSystemBackends,
  FileSystemPath,
  isLLMContentArray,
} from "@google-labs/breadboard";
import { ok } from "@breadboard-ai/utils";
import { Request, Response, Router } from "express";
import { McpFileSystemBackend } from "@breadboard-ai/mcp";
import cors from "cors";
import { LLMContent } from "@breadboard-ai/types";

export { createMountedFileSystemHandler };

function createMountedFileSystemHandler() {
  const backend = composeFileSystemBackends(
    new Map([["mcp", new McpFileSystemBackend()]])
  );
  const router = Router();
  router.use(
    cors({
      origin: true,
      credentials: true,
      maxAge: 24 * 60 * 60,
    })
  );
  // TODO: Check for auth token and make sure it's valid.
  router.all("*", async (req: Request, res: Response) => {
    const path = `/mnt${req.path}` as FileSystemPath;
    switch (req.method) {
      case "GET": {
        const reading = await backend.read("", path, false);
        if (!ok(reading)) {
          res.status(404).send(reading.$error);
          return;
        }
        res.status(200).contentType("application/json").send(reading);
        break;
      }
      case "POST": {
        const data = req.body as LLMContent[];
        if (!isLLMContentArray(data)) {
          res.status(400).send("Malformed body request");
          return;
        }
        const writing = await backend.write("", path, data);
        if (!ok(writing)) {
          res.status(400).send(writing.$error);
          return;
        }
        res.status(200).contentType("application/json").send({});
        break;
      }
      default: {
        res.status(405).send("Invalid method");
        break;
      }
    }
  });
  return router;
}
