/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  anyOf,
  defineNodeType,
  enumeration,
  object,
} from "@breadboard-ai/build";
import { StreamCapability } from "@google-labs/breadboard";

const serverSentEventTransform = () =>
  new TransformStream({
    transform(chunk, controller) {
      const text = chunk.toString();
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          let chunk;
          try {
            // Special case for OpenAI's API.
            if (data === "[DONE]") continue;
            chunk = JSON.parse(data);
          } catch (e) {
            // TODO: Handle this more gracefully.
            chunk = data;
          }
          controller.enqueue(chunk);
        }
      }
    },
  });

export default defineNodeType({
  name: "fetch",
  inputs: {
    url: {
      description: "The URL to fetch",
      type: "string",
    },
    method: {
      description: "The HTTP method to use",
      type: enumeration("GET", "POST", "PUT", "DELETE"),
      default: "GET",
    },
    headers: {
      description: "Headers to send with the request",
      type: object({}, "string"),
      default: {},
    },
    body: {
      description: "The body of the request",
      type: anyOf("string", object({}, "unknown"), "null"),
      default: null,
    },
    raw: {
      description:
        "Whether or not to return raw text (as opposed to parsing JSON)",
      type: "boolean",
      default: false,
    },
    stream: {
      description: "Whether or not to return a stream",
      type: "boolean",
      default: false,
    },
  },
  outputs: {
    response: {
      description: "The response from the fetch request",
      type: anyOf(
        "string",
        // TODO(aomarks) Is this right? Technically it could be any JSON, right?
        // So number, null, array, are also possible.
        object({}, "unknown")
      ),
    },
    status: {
      description: "The HTTP status code of the response",
      type: "number",
    },
    statusText: {
      description: "The status text of the response",
      type: "string",
    },
    contentType: {
      description: "The content type of the response",
      type: anyOf("string", "null"),
    },
    responseHeaders: {
      description: "The headers of the response",
      type: object({}, "string"),
    },
  },
  invoke: async ({ url, method, body, headers, raw, stream }) => {
    if (!url) throw new Error("Fetch requires `url` input");
    const init: RequestInit = {
      method,
      headers,
    };
    // GET can not have a body.
    if (method !== "GET") {
      init.body = JSON.stringify(body);
    } else if (body) {
      throw new Error("GET requests can not have a body");
    }
    const data = await fetch(url, init);
    const status = data.status;
    const responseHeaders: { [key: string]: string } = {};
    data.headers.forEach((value, name) => {
      responseHeaders[name] = value;
    });
    const contentType = data.headers.get("content-type");
    const statusText = data.statusText;
    if (!data.ok)
      return {
        // TODO(aomarks) Figure out how to model errors better.
        $error: await data.json(),
        status,
        statusText,
        contentType,
        responseHeaders,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    if (stream) {
      if (!data.body) {
        throw new Error("Response is not streamable.");
      }
      return {
        stream: new StreamCapability(
          data.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(serverSentEventTransform())
        ),
        // TODO(aomarks) Figure out how to model streaming responses better.
        // For now we just cast the problem away and assume the runtime knows
        // what to do.
        //
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    } else {
      let response;
      if (raw || !contentType || !contentType.includes("application/json")) {
        response = await data.text();
      } else {
        response = await data.json();
      }
      return { response, status, statusText, contentType, responseHeaders };
    }
  },
});
