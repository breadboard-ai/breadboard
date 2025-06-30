/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LoadRequest, LoadResponse } from "@breadboard-ai/types";
import { ClientTransport, ServerTransport } from "./types.js";

export class InitServer {
  #transport: ServerTransport<LoadRequest, LoadResponse>;

  constructor(transport: ServerTransport<LoadRequest, LoadResponse>) {
    this.#transport = transport;
  }

  async serve() {
    const stream = this.#transport.createServerStream();
    const reader = stream.readableRequests.getReader();
    const request = await reader.read();
    if (request.done) {
      throw new Error("Client closed stream without sending a request.");
    }
    return request.value.url;
  }
}

export class InitClient {
  #transport: ClientTransport<LoadRequest, LoadResponse>;

  constructor(transport: ClientTransport<LoadRequest, LoadResponse>) {
    this.#transport = transport;
  }

  async load(url: string) {
    const stream = this.#transport.createClientStream();
    const writer = stream.writableRequests.getWriter();
    await writer.write({ url });
    await writer.close();
  }
}
