/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PatchedReadableStream } from "../stream.js";
import { ServerBidirectionalStream, ServerTransport } from "./protocol.js";

/**
 * Minimal interface in the shape of express.js's request object.
 */
type ServerRequest<Request> = {
  body: Request;
};

/**
 * Minimal interface in the shape of express.js's response object.
 */
type ServerResponse<Response> = {
  write: (response: Response) => boolean;
  end: () => unknown;
};

export class HTTPServerTransport<Request, Response>
  implements ServerTransport<Request, Response>
{
  #request: ServerRequest<Request>;
  #response: ServerResponse<Response>;

  constructor(
    request: ServerRequest<Request>,
    response: ServerResponse<Response>
  ) {
    this.#request = request;
    this.#response = response;
  }

  createServerStream(): ServerBidirectionalStream<Request, Response> {
    const request = this.#request;
    const response = this.#response;
    return {
      readableRequests: new ReadableStream({
        start(controller) {
          controller.enqueue(request.body);
          controller.close();
        },
      }) as PatchedReadableStream<Request>,
      writableResponses: new WritableStream({
        write(chunk) {
          response.write(chunk);
        },
        close() {
          response.end();
        },
      }),
    };
  }
}
