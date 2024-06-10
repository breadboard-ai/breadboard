/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";
import { methodNotAllowed, serverError } from "../errors.js";
import { secretsKit } from "./secrets.js";
import {
  ProxyServer,
  type ServerResponse as ProxyServerResponse,
  type AnyProxyRequestMessage,
  HTTPServerTransport,
  type ProxyServerConfig,
  hasOrigin,
} from "@google-labs/breadboard/remote";
import { asRuntimeKit, createDataStore } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";

const config: ProxyServerConfig = {
  kits: [secretsKit, asRuntimeKit(Core)],
  store: createDataStore(),
  proxy: [
    "fetch",
    {
      node: "secrets",
      tunnel: {
        GEMINI_KEY: {
          to: "fetch",
          when: {
            url: hasOrigin("https://generativelanguage.googleapis.com"),
          },
        },
        SCRAPING_BEE_KEY: {
          to: "fetch",
          when: {
            url: hasOrigin("https://app.scrapingbee.com"),
          },
        },
        OPENAI_API_KEY: {
          to: "fetch",
          when: {
            url: hasOrigin("https://api.openai.com"),
          },
        },
        ELEVENLABS_API_KEY: {
          to: "fetch",
          when: {
            url: hasOrigin("https://api.elevenlabs.io"),
          },
        },
      },
    },
  ],
};

class ResponseAdapter implements ProxyServerResponse {
  #response: ServerResponse;

  constructor(response: ServerResponse) {
    this.#response = response;
  }

  header(field: string, value: string): unknown {
    this.#response.setHeader(field, value);
    return this;
  }

  write(chunk: unknown): boolean {
    return this.#response.write(chunk);
  }

  end(): unknown {
    this.#response.end();
    return this;
  }
}

const extractRequestBody = async (request: IncomingMessage) => {
  return new Promise<AnyProxyRequestMessage>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      resolve(JSON.parse(body) as AnyProxyRequestMessage);
    });
    request.on("error", reject);
  });
};

export const serveProxyAPI = async (
  req: IncomingMessage,
  res: ServerResponse
) => {
  const path = req.url;
  const isProxy = path === "/proxy" || path === "/proxy/";
  if (!isProxy) {
    return false;
  }

  if (req.method !== "POST") {
    methodNotAllowed(res, "Use POST method");
    return true;
  }

  const body = await extractRequestBody(req);
  const server = new ProxyServer(
    new HTTPServerTransport({ body }, new ResponseAdapter(res))
  );
  try {
    await server.serve(config);
  } catch (e) {
    serverError(res, (e as Error).message);
  }

  return true;
};
