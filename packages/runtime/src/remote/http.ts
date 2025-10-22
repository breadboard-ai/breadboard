/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PatchedReadableStream,
  patchReadableStream,
  stringifyWithStreams,
} from "../stream.js";
import { ServerBidirectionalStream, ServerTransport } from "./types.js";

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
