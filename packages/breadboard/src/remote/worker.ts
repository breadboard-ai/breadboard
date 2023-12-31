/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PatchedReadableStream,
  PortStreams,
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
  worker.postMessage(
    {
      type: "starttransport",
      port,
    },
    [port]
  );
};

export const receiveStartTransportMessage = (
  worker: Worker,
  callback: (port: MessagePort) => void
) => {
  worker.addEventListener("message", (event) => {
    if (event.data?.type === "starttransport") {
      callback(event.data.port);
    }
  });
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
  #clientStreams?: PortStreams<Request, Response>;
  #ready: Promise<void>;

  private constructor(worker: Worker) {
    this.#ready = new Promise((resolve) => {
      receiveStartTransportMessage(worker, (port) => {
        this.#clientStreams = portToStreams(port);
        resolve();
      });
    });
  }

  async #waitForClient() {
    await this.#ready;
  }

  createServerStream(): ServerBidirectionalStream<Request, Response> {
    if (!this.#clientStreams) {
      throw new Error("The client has not connected yet");
    }
    return {
      readableRequests: this.#clientStreams
        .readable as PatchedReadableStream<Request>,
      writableResponses: this.#clientStreams.writable,
    };
  }

  static async create<Request, Response>(
    worker: Worker
  ): Promise<WorkerServerTransport<Request, Response>> {
    const transport = new WorkerServerTransport<Request, Response>(worker);
    await transport.#waitForClient();
    return transport;
  }
}
