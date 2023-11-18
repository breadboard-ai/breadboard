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

interface MessagePortLike {
  postMessage(message: unknown): void;
  onmessage: ((ev: MessageEvent) => unknown) | null;
}

type Streams<Read, Write> = {
  readable: ReadableStream<Read>;
  writable: WritableStream<Write>;
};

const portToStreams = <Read, Write>(
  tag: string,
  port: MessagePortLike
): Streams<Read, Write> => {
  const readable = new ReadableStream<Read>({
    start(controller) {
      port.onmessage = (ev) => {
        if (ev.data === null) {
          controller.close();
          return;
        }
        controller.enqueue(ev.data);
      };
    },
    cancel() {
      port.onmessage = null;
    },
  });
  const writable = new WritableStream<Write>({
    write(chunk) {
      // TODO: Teach it handle streams.
      port.postMessage(chunk);
    },
    close() {
      port.postMessage(null);
    },
  });
  return {
    readable,
    writable,
  };
};

export class MockWorkerTransport implements ServerTransport, ClientTransport {
  #workerStreams: Streams<AnyRunRequestMessage, AnyRunResponseMessage>;
  #hostStreams: Streams<AnyRunResponseMessage, AnyRunRequestMessage>;

  constructor() {
    const channel = new MessageChannel();
    this.#workerStreams = portToStreams("worker", channel.port1);
    this.#hostStreams = portToStreams("host", channel.port2);
  }

  createClientStream(): ClientBidirectionalStream {
    return {
      writableRequests: this.#hostStreams.writable,
      readableResponses: this.#hostStreams.readable as RunResponseStream,
    };
  }

  createServerStream(): ServerBidirectionalStream {
    return {
      readableRequests: this.#workerStreams.readable as RunRequestStream,
      writableResponses: this.#workerStreams.writable,
    };
  }
}
