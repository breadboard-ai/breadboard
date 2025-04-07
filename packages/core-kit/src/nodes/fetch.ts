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
  asBlob,
  inflateData,
  isDataCapability,
  ok,
  writablePathFromString,
} from "@google-labs/breadboard";
import { llmContentTransform } from "../llm-content-transform.js";

// const serverSentEventTransform = () =>
//   new TransformStream({
//     transform(chunk, controller) {
//       const text = chunk.toString();
//       const lines = text.split("\n");
//       for (const line of lines) {
//         if (line.startsWith("data: ")) {
//           const data = line.slice(6);
//           let chunk;
//           try {
//             // Special case for OpenAI's API.
//             if (data === "[DONE]") continue;
//             chunk = JSON.parse(data);
//           } catch (e) {
//             // TODO: Handle this more gracefully.
//             chunk = data;
//           }
//           controller.enqueue(chunk);
//         }
//       }
//     },
//   });

const createBody = async (
  body: unknown,
  headers: Record<string, string | undefined>,
  store?: DataStore
) => {
  if (!body) return undefined;
  if (typeof body === "string") return body;
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
  }
  const data = store ? await inflateData(store, body) : body;
  return JSON.stringify(data);
};

export default defineNodeType({
  name: "fetch",
  metadata: {
    title: "Fetch",
    description:
      "A wrapper around `fetch` API. Use this node to fetch content from the Web.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-fetch-component",
    },
  },
  inputs: {
    url: {
      description: "The URL to fetch",
      title: "URL",
      type: "string",
    },
    method: {
      title: "Method",
      behavior: ["config"],
      description: "The HTTP method to use",
      type: enumeration("GET", "POST", "PUT", "DELETE"),
      default: "GET",
    },
    headers: {
      title: "Headers",
      description: "Headers to send with the request",
      type: object({}, "string"),
      default: {},
    },
    body: {
      title: "Body",
      description: "The body of the request",
      type: "unknown",
      optional: true,
    },
    raw: {
      title: "Raw",
      behavior: ["config"],
      description:
        "Whether or not to return raw text (as opposed to parsing JSON)",
      type: "boolean",
      default: false,
    },
    stream: {
      title: "Stream",
      behavior: ["config"],
      description: "Whether or not to return a stream",
      type: enumeration("sse", "text", "json"),
      optional: true,
    },
    redirect: {
      title: "Redirect",
      type: enumeration("follow", "error", "manual"),
      default: "follow",
    },
    file: {
      title: "File",
      description: "The File System Path where the response will be saved",
      type: "string",
      optional: true,
    },
  },
  outputs: {
    response: {
      title: "Response",
      description: "The response from the fetch request",
      type: "unknown",
      primary: true,
    },
    status: {
      title: "Status",
      description: "The HTTP status code of the response",
      type: "number",
    },
    statusText: {
      title: "Status Text",
      description: "The status text of the response",
      type: "string",
    },
    contentType: {
      title: "Content Type",
      description: "The content type of the response",
      type: anyOf("string", "null"),
    },
    responseHeaders: {
      title: "Response Headers",
      description: "The headers of the response",
      type: object({}, "string"),
    },
  },
  invoke: async (
    { url, method, body, headers, raw, stream, redirect, file },
    _, // No dynamic inputs.
    { signal, store, fileSystem }: NodeHandlerContext
  ) => {
    if (!url) throw new Error("Fetch requires `url` input");
    const init: RequestInit = {
      method,
      headers,
      redirect,
    };
    if (!stream && signal) {
      init.signal = signal;
    }
    // GET can not have a body.
    if (method !== "GET") {
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
      if (!fileSystem) {
        throw new Error(
          "File system isn't available. Unable to save streaming response"
        );
      }
      if (!file) {
        throw new Error("File path must be specified.");
      }
      const path = writablePathFromString(file);
      if (!ok(path)) {
        throw new Error(path.$error);
      }
      const readable = data.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(llmContentTransform(stream));
      const writing = await fileSystem.addStream({
        path,
        stream: readable,
      });
      if (!ok(writing)) return writing;

      return {
        response: file,
        status,
        statusText,
        contentType,
        responseHeaders,
      };
    } else {
      let response;
      if (!contentType) {
        response = await data.text();
      } else {
        const isJson = contentType?.includes("application/json");
        const isText = contentType?.startsWith("text/");
        const isXML = contentType?.startsWith("application/xml");
        if (isJson) {
          response = raw ? await data.text() : await data.json();
        } else if (isText || isXML) {
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
      if (file && fileSystem) {
        const path = writablePathFromString(file);
        if (!ok(path)) {
          throw new Error(path.$error);
        }
        let data;
        if (typeof response === "string") {
          data = [{ parts: [{ text: response }] }];
        } else if ("storedData" in response) {
          data = [{ parts: [response] }];
        } else {
          data = [{ parts: [{ json: response }] }];
        }
        const stored = await fileSystem.write({
          path,
          data,
        });
        if (!ok(stored)) {
          throw new Error(stored.$error);
        }
        response = path;
      }
      return { response, status, statusText, contentType, responseHeaders };
    }
  },
});
