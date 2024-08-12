/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatRunError } from "../harness/error.js";
import { timestamp } from "../timestamp.js";
import {
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
  #diagnostics: boolean;

  constructor(writer: RemoteMessageWriter, diagnostics: boolean) {
    this.#writer = writer;
    this.#diagnostics = diagnostics;
  }

  async writeGraphStart(data: GraphStartProbeData) {
    await this.#writer.write(["graphstart", data]);
  }

  async writeGraphEnd(data: GraphEndProbeData) {
    await this.#writer.write(["graphend", data]);
  }

  async writeNodeStart(data: NodeStartResponse) {
    await this.#writer.write(["nodestart", data]);
  }

  async writeNodeEnd(data: NodeEndResponse) {
    await this.#writer.write(["nodeend", data]);
  }

  async writeSkip(_data: SkipProbeMessage["data"]) {
    // Do not write skip messages to the server.
    // await this.#writer.write(["skip", data]);
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
