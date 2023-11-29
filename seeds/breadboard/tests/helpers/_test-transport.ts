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
import { ServerRequest, ServerResponse } from "../../src/remote/http.js";
import { TransformStream } from "stream/web";

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

type MockRequestHandler<Request> = (
  request: ServerRequest<Request>,
  response: ServerResponse
) => void;

type MockHTTPConnectionOptions = {
  breakChunks?: boolean;
  combineChunks?: boolean;
};

const createChunkMutator = (options: MockHTTPConnectionOptions) => {
  const { breakChunks, combineChunks } = options;
  if (breakChunks) {
    return (
      response: unknown,
      writer: WritableStreamDefaultWriter<Uint8Array>
    ) => {
      if (typeof response !== "string")
        throw new Error("Expected string response.");
      const encoder = new TextEncoder();
      // split chunk in two
      const chunkSize = Math.floor(response.length / 2);
      for (let i = 0; i < response.length; i += chunkSize) {
        writer.write(encoder.encode(response.slice(i, i + chunkSize)));
      }
    };
  } else if (combineChunks) {
    const chunkQueue: Uint8Array[] = [];
    return (
      response: unknown,
      writer: WritableStreamDefaultWriter<Uint8Array>
    ) => {
      if (typeof response !== "string")
        throw new Error("Expected string response.");
      const encoder = new TextEncoder();
      // remember chunks in a queue of 2
      // and push them when the queue is full
      chunkQueue.push(encoder.encode(response));
      if (chunkQueue.length < 2) return;
      while (chunkQueue.length > 0) {
        writer.write(chunkQueue.shift());
      }
    };
  } else {
    return (
      response: unknown,
      writer: WritableStreamDefaultWriter<Uint8Array>
    ) => {
      if (typeof response !== "string")
        throw new Error("Expected string response.");
      writer.write(new TextEncoder().encode(response));
    };
  }
};

/**
 * Creates a pretend Internet to enable end-to-end testing
 * of HTTPClientTransport and HTTPServerTransport.
 */
export class MockHTTPConnection<Request> {
  #handler?: MockRequestHandler<Request>;
  #options: MockHTTPConnectionOptions;

  constructor(options: MockHTTPConnectionOptions = {}) {
    this.#options = options;
  }

  get fetch() {
    return async (_: unknown, init?: RequestInit) => {
      const pipe = new TransformStream<Uint8Array, Uint8Array>();
      const writer = pipe.writable.getWriter();
      if (!this.#handler) throw new Error("Set request handler first.");
      const { body } = init || {};
      const request = { body: JSON.parse(body as string) };
      const chunkMutator = createChunkMutator(this.#options);
      const response = {
        write(response: unknown) {
          chunkMutator(response, writer);
          return true;
        },
        end() {
          writer.close();
        },
      };
      this.#handler(request, response);

      return {
        ok: true,
        get body() {
          return pipe.readable;
        },
      } as unknown as globalThis.Response;
    };
  }

  onRequest(handler: MockRequestHandler<Request>) {
    this.#handler = handler;
  }
}
