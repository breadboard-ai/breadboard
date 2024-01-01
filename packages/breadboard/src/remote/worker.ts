/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PatchedReadableStream,
  PortStreams,
  portFactoryToStreams,
  portToStreams,
  streamFromReader,
  streamFromWriter,
} from "../stream.js";
import {
  ClientTransport,
  ServerBidirectionalStream,
  ServerTransport,
} from "./protocol.js";

export const sendStartTransportMessage = (
  worker: Worker,
  port: MessagePort
) => {
  worker.postMessage({ type: "starttransport", port }, [port]);
};

export const receiveStartTransportMessage = (
  worker: Worker,
  callback: (port: MessagePort) => void
) => {
  const listener = (event: MessageEvent) => {
    if (event.data?.type === "starttransport") {
      callback(event.data.port);
      worker.removeEventListener("message", listener);
    }
  };
  worker.addEventListener("message", listener);
};

export class WorkerClientTransport<Request, Response>
  implements ClientTransport<Request, Response>
{
  #reader: ReadableStreamDefaultReader<Response>;
  #writer: WritableStreamDefaultWriter<Request>;

  constructor(worker: Worker) {
    const channel = new MessageChannel();
    worker.postMessage(sendStartTransportMessage(worker, channel.port1));
    const streams = portToStreams<Response, Request>(channel.port2);
    this.#reader = streams.readable.getReader();
    this.#writer = streams.writable.getWriter();
  }

  createClientStream() {
    return {
      writableRequests: streamFromWriter(this.#writer),
      readableResponses: streamFromReader(this.#reader),
    };
  }
}

export class WorkerServerTransport<Request, Response>
  implements ServerTransport<Request, Response>
{
  #clientStreams: PortStreams<Request, Response>;

  constructor(worker: Worker) {
    this.#clientStreams = portFactoryToStreams<Request, Response>(() => {
      return new Promise((resolve) => {
        receiveStartTransportMessage(worker, resolve);
      });
    });
  }

  createServerStream(): ServerBidirectionalStream<Request, Response> {
    return {
      readableRequests: this.#clientStreams
        .readable as PatchedReadableStream<Request>,
      writableResponses: this.#clientStreams.writable,
    };
  }
}
