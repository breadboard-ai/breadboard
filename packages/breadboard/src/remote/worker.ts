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
} from "./types.js";

const DISPATCHER_SEND = "port-dispatcher-sendport";

export class PortDispatcher {
  #worker: Worker;
  #waitForSender: Map<string, (port: MessagePort) => void> = new Map();
  #pool: Map<string, MessagePort> = new Map();

  constructor(worker: Worker) {
    this.#worker = worker;
    this.#worker.addEventListener("message", (event) => {
      const { type, id, port } = event.data;
      if (type !== DISPATCHER_SEND) return;
      const waiting = this.#waitForSender.get(id);
      if (waiting) {
        waiting(port);
        this.#waitForSender.delete(id);
      } else {
        this.#pool.set(id, port);
      }
    });
  }

  receive<Request, Response>(id: string): PortStreams<Request, Response> {
    const pooledPort = this.#pool.get(id);
    if (pooledPort) {
      this.#pool.delete(id);
      return portToStreams(pooledPort);
    }
    return portFactoryToStreams<Request, Response>(() => {
      return new Promise((resolve) => {
        this.#waitForSender.set(id, resolve);
      });
    });
  }

  send<Request, Response>(id: string): PortStreams<Request, Response> {
    const { port1, port2 } = new MessageChannel();
    this.#worker.postMessage({ type: DISPATCHER_SEND, id, port: port2 }, [
      port2,
    ]);
    return portToStreams(port1);
  }
}

export class WorkerClientTransport<Request, Response>
  implements ClientTransport<Request, Response>
{
  #reader: ReadableStreamDefaultReader<Response>;
  #writer: WritableStreamDefaultWriter<Request>;

  constructor(streams: PortStreams<Response, Request>) {
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

  constructor(streams: PortStreams<Request, Response>) {
    this.#clientStreams = streams;
  }

  createServerStream(): ServerBidirectionalStream<Request, Response> {
    return {
      readableRequests: this.#clientStreams
        .readable as PatchedReadableStream<Request>,
      writableResponses: this.#clientStreams.writable,
    };
  }
}
