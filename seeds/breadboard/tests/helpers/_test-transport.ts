/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  ClientBidirectionalStream,
  ClientTransport,
  RunRequestStream,
  RunResponseStream,
  ServerBidirectionalStream,
  ServerTransport,
} from "../../src/remote/protocol.js";

export class IdentityTransport implements ServerTransport, ClientTransport {
  #requestPipe = new TransformStream<
    AnyRunRequestMessage,
    AnyRunRequestMessage
  >();
  #responsePipe = new TransformStream<
    AnyRunResponseMessage,
    AnyRunResponseMessage
  >();

  createClientStream(): ClientBidirectionalStream {
    return {
      writableRequests: this.#requestPipe.writable,
      readableResponses: this.#responsePipe.readable as RunResponseStream,
    };
  }

  createServerStream(): ServerBidirectionalStream {
    return {
      readableRequests: this.#requestPipe.readable as RunRequestStream,
      writableResponses: this.#responsePipe.writable,
    };
  }
}
