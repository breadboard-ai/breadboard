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
  write: (chunk: unknown) => boolean;
  end: () => unknown;
};

const isIterable = (o: unknown): boolean => {
  return typeof o === "object" && o !== null && Symbol.iterator in o;
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
          response.write(`${JSON.stringify(chunk)}\n`);
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

const chunkRepairTransform = () => {
  const queue: string[] = [];
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      const brokenChunk = !chunk.endsWith("\n");
      const chunks = chunk.split("\n").filter(Boolean);
      // If there are items in the queue, prepend them to the first chunk
      // and enqueue the result.
      if (queue.length) {
        controller.enqueue(`${queue.shift()}${chunks.shift()}`);
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
    flush(controller) {
      if (queue.length) {
        controller.enqueue(queue.shift());
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
    this.#fetch = this.#options.fetch ?? globalThis.fetch;
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
