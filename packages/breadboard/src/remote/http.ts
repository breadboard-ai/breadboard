/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PatchedReadableStream, patchReadableStream } from "../stream.js";
import {
  ClientBidirectionalStream,
  ClientTransport,
  ServerBidirectionalStream,
  ServerTransport,
} from "./protocol.js";

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

const isIterable = (o: unknown): boolean => {
  return typeof o === "object" && o !== null && Symbol.iterator in o;
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

export class HTTPServerTransport<Request, Response>
  implements ServerTransport<Request, Response>
{
  #request: ServerRequest<Request>;
  #response: ServerResponse;

  constructor(request: ServerRequest<Request>, response: ServerResponse) {
    this.#request = request;
    this.#response = response;
  }

  createServerStream(): ServerBidirectionalStream<Request, Response> {
    const request = this.#request;
    const response = this.#response;
    patchReadableStream();
    response.header("Content-Type", "text/event-stream");
    return {
      readableRequests: new ReadableStream({
        start(controller) {
          if (!isIterable(request.body)) {
            controller.error(
              new Error(
                "Unexpected uniterable body. This is likely a result of processing a GET request. Only POST requests are supported."
              )
            );
            return;
          }
          controller.enqueue(request.body);
          controller.close();
        },
      }) as PatchedReadableStream<Request>,
      writableResponses: new WritableStream({
        write(chunk) {
          response.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
        close() {
          response.end();
        },
      }),
    };
  }
}

export type HTTPClientTransportOptions = RequestInit & {
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

export class HTTPClientTransport<Request, Response>
  implements ClientTransport<Request, Response>
{
  #url: string;
  #options: HTTPClientTransportOptions;
  #fetch: typeof globalThis.fetch;

  constructor(url: string, options?: HTTPClientTransportOptions) {
    this.#url = url;
    this.#options = {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    this.#fetch = this.#options.fetch ?? globalThis.fetch.bind(globalThis);
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
          const response = await responsePromise;
          const reader = response.getReader();
          for (;;) {
            const result = await reader.read();
            if (result.done) {
              break;
            } else {
              console.log(
                "%cServer-Sent Event Chunk",
                "background: #009; color: #FFF",
                result.value
              );
              controller.enqueue(result.value as Response);
            }
          }
          controller.close();
        },
      }) as PatchedReadableStream<Response>,
      writableRequests: new WritableStream<Request>({
        async write(chunk, controller) {
          if (!responseResolve) {
            throw new Error(
              "HTTPClientTransport supports only one write per stream instance."
            );
          }
          const response = await that.#fetch(that.#url, {
            ...that.#options,
            body: JSON.stringify(chunk),
          });
          if (!response.ok) {
            controller.error(new Error(`HTTP error: ${response.status}`));
          }
          responseResolve(
            response.body
              ?.pipeThrough(new TextDecoderStream())
              .pipeThrough(chunkRepairTransform())
              .pipeThrough(serverStreamEventDecoder())
              .pipeThrough(
                new TransformStream({
                  transform(chunk, controller) {
                    controller.enqueue(JSON.parse(chunk) as Response);
                  },
                })
              ) as PatchedReadableStream<Response>
          );
          responseResolve = undefined;
        },
      }),
    };
  }
}
