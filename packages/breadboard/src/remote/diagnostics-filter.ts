/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatRunError } from "../harness/error.js";
import type { RunDiagnosticsLevel } from "../harness/types.js";
import { timestamp } from "../timestamp.js";
import type {
  EdgeResponse,
  ErrorResponse,
  GraphEndProbeData,
  GraphStartProbeData,
  InputResponse,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
  SkipProbeMessage,
} from "../types.js";
import { End, RemoteMessageWriter } from "./types.js";

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
    await this.#writer.write(["graphstart", data]);
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
    await this.#writer.write(["nodestart", data]);
  }

  async writeNodeEnd(data: NodeEndResponse) {
    if (this.#filterTop(data.path.length)) {
      return;
    }
    await this.#writer.write(["nodeend", data]);
  }

  async writeSkip(_data: SkipProbeMessage["data"]) {
    // Do not write skip messages to the server.
    // await this.#writer.write(["skip", data]);
  }

  async writeEdge(data: EdgeResponse) {
    if (this.#filterTop(data.to.length)) {
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
