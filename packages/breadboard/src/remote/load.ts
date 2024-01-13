/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner } from "../runner.js";
import {
  ClientTransport,
  LoadRequest,
  LoadResponse,
  ServerTransport,
} from "./protocol.js";

export class LoadServer {
  #transport: ServerTransport<LoadRequest, LoadResponse>;

  constructor(transport: ServerTransport<LoadRequest, LoadResponse>) {
    this.#transport = transport;
  }

  async serve(loader: (url: string) => Promise<BoardRunner>) {
    const stream = this.#transport.createServerStream();
    const reader = stream.readableRequests.getReader();
    const request = await reader.read();
    if (request.done) {
      return;
    }
    const { url } = request.value;
    const runner = await loader(url);

    const { title, description, version } = runner;
    const diagram = runner.mermaid("TD", true);
    const nodes = runner.nodes;

    const response: LoadResponse = {
      title,
      description,
      version,
      diagram,
      url,
      nodes,
    };

    const writer = stream.writableResponses.getWriter();
    await writer.write(response);
  }
}

export class LoadClient {
  #transport: ClientTransport<LoadRequest, LoadResponse>;

  constructor(transport: ClientTransport<LoadRequest, LoadResponse>) {
    this.#transport = transport;
  }

  async load(url: string) {
    const stream = this.#transport.createClientStream();
    const writer = stream.writableRequests.getWriter();
    await writer.write({ url });
    await writer.close();

    const reader = stream.readableResponses.getReader();
    const response = await reader.read();
    if (response.done) {
      throw new Error("Server closed stream without sending a response.");
    }
    return response.value;
  }
}
