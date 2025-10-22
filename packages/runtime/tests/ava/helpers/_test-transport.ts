/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransformStream } from "stream/web";
import { ClientTransport, ServerTransport } from "../../../src/remote/types.js";
import { PatchedReadableStream } from "../../../src/stream.js";

export class IdentityTransport<Request, Response>
  implements
    ServerTransport<Request, Response>,
    ClientTransport<Request, Response>
{
  #requestPipe = new TransformStream<Request, Request>();
  #responsePipe = new TransformStream<Response, Response>();

  createClientStream() {
    return {
      writableRequests: this.#requestPipe.writable,
      readableResponses: this.#responsePipe
        .readable as PatchedReadableStream<Response>,
    };
  }

  createServerStream() {
    return {
      readableRequests: this.#requestPipe
        .readable as PatchedReadableStream<Request>,
      writableResponses: this.#responsePipe.writable,
    };
  }
}

/**
 * Creates a pretend Worker to enable end-to-end testing
 * of WorkerClientTransport and WorkerServerTransport.
 *
 * Returns an pair of objects that look like worker and
 * worker host (both are Worker instances in TS).
 * The objects implement:
 * - postMessage
 * - addEventListener
 * And act as if they are connected to each other.
 */
export const createMockWorkers = () => {
  const channel = new MessageChannel();
  const port1 = channel.port1;
  const port2 = channel.port2;
  port1.start();
  port2.start();
  return {
    worker: port1 as unknown as Worker,
    host: port2 as unknown as Worker,
  };
};
