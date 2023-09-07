/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Response } from "express";

import { RunResult, RunResultType } from "@google-labs/breadboard";
import { InputValues, OutputValues } from "@google-labs/graph-runner";

export type ToWrite = {
  type: RunResultType | "done" | "error";
  data: InputValues | OutputValues;
  state: string | undefined;
};

export type StateTransformer = (state: string) => Promise<string>;

export type WriterResponse = Pick<Response, "write">;

export class Writer {
  #res: WriterResponse;
  #stateTransformer: StateTransformer;

  constructor(res: WriterResponse, stateTransformer: StateTransformer) {
    this.#res = res;
    this.#stateTransformer = stateTransformer;
  }

  async writeInput(stop: RunResult) {
    const state = stop.isAtExitNode()
      ? undefined
      : await this.#stateTransformer(stop.save());
    this.write({
      type: "input",
      data: stop.inputArguments,
      state,
    });
  }

  async writeOutput(stop: RunResult) {
    const state = stop.isAtExitNode()
      ? undefined
      : await this.#stateTransformer(stop.save());
    this.write({
      type: "output",
      data: stop.outputs,
      state,
    });
  }

  writeBeforeHandler(stop: RunResult) {
    this.write({
      type: "beforehandler",
      data: stop.node,
      state: undefined,
    });
  }

  writeDone() {
    this.write({
      type: "done",
      data: {},
      state: undefined,
    });
  }

  writeError(error: Error) {
    this.write({
      type: "error",
      data: { message: error.message },
      state: undefined,
    });
  }

  writeStop() {
    this.#res.write("stop\n");
  }

  write(data: ToWrite) {
    this.#res.write(`${JSON.stringify(data)}\n`);
  }
}
