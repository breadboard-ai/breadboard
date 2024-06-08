/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PatchedReadableStream, parseWithStreams } from "../stream.js";
import { ClientBidirectionalStream, ClientTransport } from "./protocol.js";

import { v4 as uuidv4 } from "uuid";

/**
 * Minimal interface in the shape of express.js's request object.
 */
export type ServerRequest<Request> = {
  body: Request;
};

/**
 * Minimal interface in the shape of express.js's response object.
 */
export type ServerResponse = {
  header(field: string, value: string): unknown;
  write: (chunk: unknown) => boolean;
  end: () => unknown;
};

const serverStreamEventDecoder = () => {
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      if (chunk.startsWith("data: ")) {
        controller.enqueue(chunk.slice(6));
      }
    },
  });
};

export const parseWithStreamsTransform = () => {
  const siphon = new TransformStream();
  const writer = siphon.writable.getWriter();
  return new TransformStream({
    transform(chunk, controller) {
      const parsed = parseWithStreams(chunk, (id) => {
        if (id !== 0) {
          throw new Error(
            "HTTPClientTransport does not support multiple streams at the moment."
          );
        }
        return siphon.readable;
      });
      // Siphon away chunks into the stream.
      const [type] = Array.isArray(parsed) ? parsed : [];
      if (type === "http-stream-chunk") {
        writer.write(parsed[1].chunk);
      } else if (type === "http-stream-end") {
        writer.close();
      } else {
        controller.enqueue(parsed as Response);
      }
    },
  });
};

export type ColabClientTransportOptions = RequestInit & {
  fetch?: typeof globalThis.fetch;
};

/**
 * When processing HTTP responses, the server may send chunks that are
 * broken in two ways:
 * - Multiple chunks might be merged together
 * - A single chunk might be broken into multiple chunks.
 *
 * This transform stream repairs such chunks, merging broken chunks and
 * splitting merged chunks.
 *
 * @returns The transform stream that repaired chunks.
 */
const chunkRepairTransform = () => {
  let queue: string[] = [];
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      const brokenChunk = !chunk.endsWith("\n");
      const chunks = chunk.split("\n").filter(Boolean);
      // If there are items in the queue, prepend them to the first chunk
      // and enqueue the result.
      if (queue.length && !brokenChunk) {
        controller.enqueue(`${queue.join("")}${chunks.shift()}`);
        queue = [];
      }
      // Queue all chunks except the last one.
      while (chunks.length > 1) {
        controller.enqueue(chunks.shift());
      }
      const lastChunk = chunks.shift();
      if (!lastChunk) return;

      if (brokenChunk) {
        queue.push(lastChunk);
      } else {
        controller.enqueue(lastChunk);
      }
    },
    flush() {
      // The queue should be empty at the end of the stream.
      // The presence of items in the queue is an indication that the
      // stream was not formatted correctly.
      if (queue.length) {
        throw new Error("Unexpected end of stream.");
      }
    },
  });
};

export class ColabClientTransport<Request, Response>
  implements ClientTransport<Request, Response>
{
  #ws: WebSocket | undefined;
  #stream: ReadableStream | undefined;

  constructor() {
    this.connectToColab();
  }

  async connectToColab() {
    console.log("KEX: creating Proxy Kit for");
    // KEX: Can I try to auth now?
    const login_url =
      //"https://b2607f8b048001000007fe700c0a8523f22b8000000000000000001.proxy.googlers.com/corplogin_xsrf";
      "https://localhost:8888/corplogin_xsrf";
    //https://b2607f8b048001000007fe700c0a8523f22b8000000000000000001.proxy.googlers.com/corplogin_xsrf
    const proxy_url =
      "b2607f8b048001000007fe700c0a8523f22b8000000000000000001.proxy.googlers.com";
    const real_login_url =
      "https://b2607f8b048001000007fe700c0a8523f22b8000000000000000001.proxy.googlers.com/corplogin_xsrf";
    //window.open(login_url);
    console.log("opeend login window");
    const that = this;
    let myContainer = document.getElementById("content");
    //document.rootElement
    const final_ws = await fetch(real_login_url, {
      method: "GET",
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          console.log("Not ok response");
          console.log(response);
          throw new Error(response.statusText);
        }
        console.log("Got fetch response!");
        console.log(response);
        return response.text();
      })
      .then(function (string) {
        console.log("Trying to set content");
        console.log(string);
        const regex = new RegExp('.*"token": "(.*)".*');
        var matches = regex.exec(string);
        console.log("The token:");
        if (matches !== null) {
          console.log(matches[1]);
          var token = matches[1];
          return matches[1];
        }
        throw new Error("Unable to get token. No match");
      })
      .then(function (token) {
        console.log("Going to fetch now");
        const session_url =
          "https://" +
          proxy_url +
          "/api/sessions?authuser=0&colab_xsrf_token=" +
          token;
        const content = {
          name: "Breadboardtest.ipnyb",
          path: "fileId=breadboardtest&username=kevxiao",
          type: "notebook",
        };
        fetch(session_url, {
          method: "POST",
          body: JSON.stringify(content),
          credentials: "include",
        })
          .then(function (response) {
            if (!response.ok) {
              console.log("Not ok response from post");
              console.log(response);
              throw new Error(response.statusText);
            }
            console.log("Got fetch response!");
            console.log(response);
            return response.json();
          })
          .then(function (resp) {
            const kernel_id = resp["kernel"]["id"];
            console.log("Got kernel_id %s", kernel_id);

            let session_id = uuidv4();
            console.log("Generated uuid: %s", session_id);
            const ws_url =
              "wss://" +
              proxy_url +
              "/api/kernels/" +
              kernel_id +
              "/channels?session_id=" +
              session_id +
              "&colab_xsrf_token=" +
              token;
            console.log("Wss socket: %s", ws_url);

            const ws = new WebSocket(ws_url);
            ws.onopen = (event: Event) => {
              console.log("Connected to server");

              ws.send("Hello, server!");
            };

            ws.onmessage = (message: MessageEvent) => {
              console.log(`Received message from server: ${message}`);
            };

            ws.onclose = (event: CloseEvent) => {
              console.log("Disconnected from server");
            };
            that.#ws = ws;
            return ws;
          });
      });
    return final_ws;
  }

  createClientStream(): ClientBidirectionalStream<Request, Response> {
    let responseResolve:
      | undefined
      | ((response: PatchedReadableStream<Response>) => void);
    const responsePromise: Promise<PatchedReadableStream<Response>> =
      new Promise((resolve) => {
        responseResolve = resolve;
      });

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    return {
      readableResponses: new ReadableStream<Response>({
        async pull(controller) {
          if (!that.#stream) {
            throw new Error("WS stream not initialized");
          }
          for (;;) {
            const result = await that.#stream.getReader().read();
            console.log(result);
            if (result.done) break;
          }
        },
      }) as PatchedReadableStream<Response>,
      writableRequests: new WritableStream<Request>({
        async write(chunk, controller) {
          if (!responseResolve) {
            throw new Error(
              "ColabClientTransport supports only one write per stream instance."
            );
          }
          if (!that.#ws) {
            throw new Error("WS not initialized");
          }
          const response = await that.#ws.send(JSON.stringify(chunk));
          responseResolve = undefined;
        },
      }),
    };
  }
}
