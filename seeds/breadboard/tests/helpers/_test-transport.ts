/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientTransport, ServerTransport } from "../../src/remote/protocol.js";
import {
  PatchedReadableStream,
  PortStreams,
  portToStreams,
} from "../../src/stream.js";

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

export class MockWorkerTransport<Request, Response>
  implements
    ServerTransport<Request, Response>,
    ClientTransport<Request, Response>
{
  #workerStreams: PortStreams<Request, Response>;
  #hostStreams: PortStreams<Response, Request>;

  constructor() {
    const channel = new MessageChannel();
    this.#workerStreams = portToStreams(channel.port1);
    this.#hostStreams = portToStreams(channel.port2);
  }

  createClientStream() {
    return {
      writableRequests: this.#hostStreams.writable,
      readableResponses: this.#hostStreams
        .readable as PatchedReadableStream<Response>,
    };
  }

  createServerStream() {
    return {
      readableRequests: this.#workerStreams
        .readable as PatchedReadableStream<Request>,
      writableResponses: this.#workerStreams.writable,
    };
  }
}
