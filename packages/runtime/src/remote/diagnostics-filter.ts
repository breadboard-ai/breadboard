/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EdgeResponse,
  End,
  ErrorResponse,
  GraphEndProbeData,
  GraphStartProbeData,
  InputResponse,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
  RemoteMessage,
  RemoteMessageWriter,
  RunDiagnosticsLevel,
  SkipProbeMessage,
} from "@breadboard-ai/types";
import { timestamp } from "@breadboard-ai/utils";
import { formatRunError } from "../harness/error.js";

function omit<T extends RemoteMessage[1]>(message: T, ...keys: (keyof T)[]): T {
  const copy = { ...message };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

type HasDescriptor = NodeStartResponse | NodeEndResponse;

function noConfig<T extends HasDescriptor>(data: T): T {
  const node = { ...data.node };
  delete node.configuration;
  return {
    ...data,
    node,
  };
}

function noIO(data: NodeEndResponse): NodeEndResponse {
  const result = { ...data } as Partial<NodeEndResponse>;
  delete result.inputs;
  delete result.outputs;
  return result as NodeEndResponse;
}

export class DiagnosticsFilter {
  #writer: RemoteMessageWriter;
  #diagnostics: RunDiagnosticsLevel;

  constructor(writer: RemoteMessageWriter, diagnostics: RunDiagnosticsLevel) {
    this.#writer = writer;
    this.#diagnostics = diagnostics;
  }

  #filterTop(pathLength: number) {
    return this.#diagnostics === "top" && pathLength > 1;
  }

  async writeGraphStart(data: GraphStartProbeData) {
    if (this.#filterTop(data.path.length + 1)) {
      return;
    }
    await this.#writer.write(["graphstart", omit(data, "graph")]);
  }

  async writeGraphEnd(data: GraphEndProbeData) {
    if (this.#filterTop(data.path.length + 1)) {
      return;
    }
    await this.#writer.write(["graphend", data]);
  }

  async writeNodeStart(data: NodeStartResponse) {
    if (this.#filterTop(data.path.length)) {
      return;
    }
    await this.#writer.write(["nodestart", noConfig(omit(data, "inputs"))]);
  }

  async writeNodeEnd(data: NodeEndResponse) {
    if (this.#filterTop(data.path.length)) {
      return;
    }
    await this.#writer.write(["nodeend", noIO(noConfig(data))]);
  }

  async writeSkip(_data: SkipProbeMessage["data"]) {
    // Do not write skip messages to the server.
    // await this.#writer.write(["skip", data]);
  }

  async writeEdge(data: EdgeResponse) {
    if (this.#diagnostics !== true) {
      return;
    }
    await this.#writer.write(["edge", data]);
  }

  async writeInput(data: InputResponse, next: string) {
    await this.#writer.write(["input", data, next]);
  }

  async writeOutput(data: OutputResponse) {
    await this.#writer.write(["output", data]);
  }

  async writeError(data: ErrorResponse) {
    await this.#writer.write([
      "error",
      { error: formatRunError(data.error), timestamp: timestamp() },
    ]);
  }

  async writeEnd(data: End) {
    if (this.#diagnostics) {
      await this.#writer.write(["end", data]);
    }
  }
}
