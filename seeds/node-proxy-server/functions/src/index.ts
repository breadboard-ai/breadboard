/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { onRequest } from "firebase-functions/v2/https";
import { Request, Response, logger } from "firebase-functions";

import { Board } from "@google-labs/breadboard";
import {
  HTTPServerTransport,
  ProxyServer,
} from "@google-labs/breadboard/remote";
import { Starter } from "@google-labs/llm-starter";

const handleNonPostRequest = (request: Request, response: Response) => {
  if (request.method === "POST") return false;
  if (request.method !== "GET") {
    response.status(405);
    response.send("Method not allowed");
    return true;
  }
  if (request.path === "/") {
    response.sendFile(
      new URL("../public/index.html", import.meta.url).pathname
    );
    return true;
  } else {
    response.status(404);
    response.send("Not found");
    return true;
  }
};

export const nodeProxyServer = onRequest(
  { cors: true },
  async (request, response) => {
    if (handleNonPostRequest(request, response)) return;
    const board = new Board();
    board.addKit(Starter);

    const server = new ProxyServer(new HTTPServerTransport(request, response));
    try {
      await server.serve(board);
    } catch (e) {
      logger.error(e);
      response.status(500).send(`500 Server Error: ${(e as Error).message}`);
    }
  }
);
