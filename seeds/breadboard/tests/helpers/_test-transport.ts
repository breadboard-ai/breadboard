/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  Transport,
  LoadRequest,
  LoadResponse,
  ProxyPromiseResponse,
  ProxyResolveRequest,
} from "../../src/remote/protocol.js";
import { PatchedReadableStream } from "../../src/stream.js";

export class TestClient implements Transport {
  #server?: Transport;

  load(request: LoadRequest): Promise<LoadResponse> {
    if (!this.#server) throw new Error("Please call `setServer` first");
    return this.#server.load(request);
  }

  run(
    request: AnyRunRequestMessage
  ): Promise<PatchedReadableStream<AnyRunResponseMessage>> {
    if (!this.#server) throw new Error("Please call `setServer` first");
    return this.#server.run(request);
  }

  proxy(request: ProxyPromiseResponse): Promise<ProxyResolveRequest> {
    if (!this.#server) throw new Error("Please call `setServer` first");
    return this.#server.proxy(request);
  }

  setServer(server: Transport) {
    this.#server = server;
  }
}
