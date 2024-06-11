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
import { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import {
  DataStore,
  NodeHandlerContext,
  StreamCapability,
  asBlob,
  inflateData,
  isDataCapability,
} from "@google-labs/breadboard";

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

const createBody = async (
  body: unknown,
  headers: Record<string, string | undefined>,
  store: DataStore
) => {
  if (!body) return undefined;
  const contentType = headers["Content-Type"];
  if (contentType === "multipart/form-data") {
    const values = body as Record<string, JsonSerializable>;
    // This is necessary to let fetch set its own content type.
    delete headers["Content-Type"];
    const formData = new FormData();
    for (const key in values) {
      const value = values[key];
      if (typeof value === "string") {
        formData.append(key, value);
      } else if (isDataCapability(value)) {
        if ("inlineData" in value) {
          formData.append(key, await asBlob(value));
        } else {
          formData.append(key, await asBlob(value));
        }
      } else {
        formData.append(key, JSON.stringify(value));
      }
    }
    return formData;
  } else if (contentType?.startsWith("multipart/related; boundary=")) {
    const values = body as Record<string, JsonSerializable>;
    const preMediaBlob = values.preMediaBlob;
    const media = values.media;
    const postMediaBlob = values.postMediaBlob;
    if (isDataCapability(media)) {
      return new Blob([
        preMediaBlob as BlobPart,
        await asBlob(media),
        postMediaBlob as BlobPart,
      ]);
    }
  }
  return JSON.stringify(await inflateData(store, body));
};

export default defineNodeType({
  name: "fetch",
  metadata: {
    title: "Fetch",
    description:
      "A wrapper around `fetch` API. Use this node to fetch content from the Web.",
  },
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
      type: "unknown",
      optional: true,
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
      type: "unknown",
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
  invoke: async (
    { url, method, body, headers, raw, stream },
    _, // No dynamic inputs.
    { signal, store }: NodeHandlerContext
  ) => {
    if (!url) throw new Error("Fetch requires `url` input");
    const init: RequestInit = { method, headers, signal };
    // GET can not have a body.
    if (method !== "GET") {
      if (!store) {
        throw new Error(
          "No store provided in run configuration to store the request."
        );
      }
      init.body = await createBody(body, headers, store);
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
      if (!contentType) {
        response = await data.text();
      } else {
        const isJson = contentType?.includes("application/json");
        const isText = contentType?.includes("text/plain");
        if (isJson) {
          response = raw ? await data.text() : await data.json();
        } else if (isText) {
          response = await data.text();
        } else {
          if (!store) {
            throw new Error(
              "No store provided in run configuration to store the response."
            );
          }
          const blob = await data.blob();
          response = await store.store(blob);
        }
      }
      return { response, status, statusText, contentType, responseHeaders };
    }
  },
});
