/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PatchedReadableStream,
  parseWithStreams,
  patchReadableStream,
  stringifyWithStreams,
} from "../stream.js";
import { chunkRepairTransform } from "./chunk-repair.js";
import {
  ClientBidirectionalStream,
  ClientTransport,
  ServerBidirectionalStream,
  ServerTransport,
} from "./types.js";

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

export const serverStreamEventDecoder = () => {
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
        async write(chunk) {
          const stringified = stringifyWithStreams(chunk);
          response.write(`data: ${stringified.value}\n\n`);
          if (stringified.streams.length) {
            if (stringified.streams.length > 1) {
              throw new Error(
                "HTTPServerTransport does not support multiple streams at the moment."
              );
            }
            // this chunk has streams, let's send the stream data
            // along with the chunk.
            const stream = stringified.streams[0];
            await stream.pipeTo(
              new WritableStream({
                write(chunk) {
                  const data = ["http-stream-chunk", { chunk }];
                  response.write(`data: ${JSON.stringify(data)}\n\n`);
                },
                close() {
                  const data = ["http-stream-end", {}];
                  response.write(`data: ${JSON.stringify(data)}\n\n`);
                },
              })
            );
          }
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
      credentials: "include",
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
                parseWithStreamsTransform()
              ) as PatchedReadableStream<Response>
          );
          responseResolve = undefined;
        },
      }),
    };
  }
}
