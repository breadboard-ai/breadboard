/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from "http";
import { Plugin, ViteDevServer } from "vite";
import { A2AClient } from "@a2a-js/sdk/client";
import {
  MessageSendParams,
  SendMessageSuccessResponse,
  Task,
} from "@a2a-js/sdk";
import { v4 as uuidv4 } from "uuid";

const fetchWithCustomHeader: typeof fetch = async (url, init) => {
  const headers = new Headers(init?.headers);
  headers.set(
    "X-A2A-Extensions",
    "https://github.com/a2aproject/a2a-samples/extensions/gulfui/v7"
  );

  const newInit = { ...init, headers };
  return fetch(url, newInit);
};

// Create a client pointing to the agent's Agent Card URL.
const client = await A2AClient.fromCardUrl(
  "http://localhost:10002/.well-known/agent-card.json",
  { fetchImpl: fetchWithCustomHeader }
);

export const customA2aHandlerPlugin = (): Plugin => {
  return {
    name: "custom-a2a-handler",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/a2a",
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          // We only want to process POST requests on this path.
          if (req.method === "POST") {
            let originalBody = "";

            req.on("data", (chunk) => {
              originalBody += chunk.toString();
            });

            req.on("end", async () => {
              const sendParams: MessageSendParams = {
                message: {
                  messageId: uuidv4(),
                  role: "user",
                  parts: [
                    {
                      kind: "text",
                      text: originalBody,
                    },
                  ],
                  kind: "message",
                },
              };

              const response = await client.sendMessage(sendParams);
              if ("error" in response) {
                console.error("Error:", response.error.message);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: response.error.message }));
                return;
              } else {
                const result = (response as SendMessageSuccessResponse)
                  .result as Task;
                if (result.kind === "task") {
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(result.status.message?.parts));
                  return;
                }
              }

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify([]));
            });

            return;
          } else {
            next();
          }
        }
      );
    },
  };
};
