/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  StreamCapability,
  type InputValues,
  type NodeDescriberFunction,
  type NodeHandler,
} from "@google-labs/breadboard";

export type FetchOutputs = {
  response: string | object;
};

export type FetchInputs = {
  /**
   * The URL to fetch
   */
  url: string;
  /*
   * The HTTP method to use
   */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /**
   * Headers to send with the request
   */
  headers?: Record<string, string>;
  /**
   * The body of the request
   */
  body?: string;
  /**
   * Whether or not to return raw text (as opposed to parsing JSON). Has no
   * effect when `stream` is true.
   */
  raw?: boolean;
  /**
   * Whether or not to return a stream
   */
  stream?: boolean;
};

export const fetchDescriber: NodeDescriberFunction = async () => {
  return {
    inputSchema: {
      type: "object",
      properties: {
        url: {
          title: "url",
          description: "The URL to fetch",
          type: "string",
        },
        method: {
          title: "method",
          description: "The HTTP method to use",
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE"],
        },
        headers: {
          title: "headers",
          description: "Headers to send with the request",
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
        body: {
          title: "body",
          description: "The body of the request",
          type: ["string", "object"],
        },
        raw: {
          title: "raw",
          description:
            "Whether or not to return raw text (as opposed to parsing JSON)",
          type: "boolean",
        },
      },
      required: ["url"],
    },
    outputSchema: {
      type: "object",
      properties: {
        response: {
          title: "response",
          description: "The response from the fetch request",
          type: ["string", "object"],
        },
      },
      required: ["response"],
    },
  };
};

export default {
  describe: fetchDescriber,
  invoke: async (inputs: InputValues) => {
    const {
      url,
      method = "GET",
      body,
      headers = {},
      raw,
      stream,
    } = inputs as FetchInputs;
    if (!url) throw new Error("Fetch requires `url` input");
    const init: RequestInit = {
      method,
      headers,
    };
    // GET can not have a body.
    if (method !== "GET") {
      init.body = JSON.stringify(body);
    }
    const data = await fetch(url, init);
    if (stream) {
      if (!data.body) {
        throw new Error("Response is not streamable.");
      }
      return { response: new StreamCapability(data.body) };
    } else {
      const response = raw ? await data.text() : await data.json();
      return { response };
    }
  },
} satisfies NodeHandler;
