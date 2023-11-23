/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  RunClientTransport,
  RunRequestStream,
  RunResponseStream,
  RunServerTransport,
} from "../../src/remote/protocol.js";
import { PortStreams, portToStreams } from "../../src/stream.js";

export class IdentityTransport
  implements RunServerTransport, RunClientTransport
{
  #requestPipe = new TransformStream<
    AnyRunRequestMessage,
    AnyRunRequestMessage
  >();
  #responsePipe = new TransformStream<
    AnyRunResponseMessage,
    AnyRunResponseMessage
  >();

  createClientStream() {
    return {
      writableRequests: this.#requestPipe.writable,
      readableResponses: this.#responsePipe.readable as RunResponseStream,
    };
  }

  createServerStream() {
    return {
      readableRequests: this.#requestPipe.readable as RunRequestStream,
      writableResponses: this.#responsePipe.writable,
    };
  }
}

export class MockWorkerTransport
  implements RunServerTransport, RunClientTransport
{
  #workerStreams: PortStreams<AnyRunRequestMessage, AnyRunResponseMessage>;
  #hostStreams: PortStreams<AnyRunResponseMessage, AnyRunRequestMessage>;

  constructor() {
    const channel = new MessageChannel();
    this.#workerStreams = portToStreams(channel.port1);
    this.#hostStreams = portToStreams(channel.port2);
  }

  createClientStream() {
    return {
      writableRequests: this.#hostStreams.writable,
      readableResponses: this.#hostStreams.readable as RunResponseStream,
    };
  }

  createServerStream() {
    return {
      readableRequests: this.#workerStreams.readable as RunRequestStream,
      writableResponses: this.#workerStreams.writable,
    };
  }
}
