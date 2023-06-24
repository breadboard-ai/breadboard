/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import {
  GraphContext,
  InputValues,
  NodeHandlers,
  OutputValues,
} from "../graph.js";

/**
 * Provides facilities to send inputs to the included graph
 * and receive outputs from it.
 */
class InputOutputHelper {
  public values: InputValues = {};

  constructor(private args: InputValues) {}
  /**
   * Substitution for the `user-input` handler.
   * @param inputs
   */
  async input(_inputs?: InputValues): Promise<OutputValues> {
    return this.args;
  }

  /**
   * Substitution for the `console-output` handler.
   * @param inputs
   */
  async output(inputs?: InputValues): Promise<OutputValues> {
    this.values = inputs || {};
    return {};
  }

  interceptInputOutput(handlers: NodeHandlers): NodeHandlers {
    return {
      ...handlers,
      "user-input": this.input.bind(this),
      "console-output": this.output.bind(this),
    };
  }
}

export default async (
  inputs?: InputValues,
  context?: GraphContext
): Promise<OutputValues> => {
  if (!inputs) throw new Error("To include, we need inputs");
  if (!context) throw new Error("To include, we need context");
  const { path, ...args } = inputs;
  if (!path) throw new Error("To include, we need a path");
  const graph = JSON.parse(await readFile(path as string, "utf-8"));
  const helper = new InputOutputHelper(args);
  const handlers = helper.interceptInputOutput(context.handlers);
  await context.follow(graph, handlers);
  return helper.values;
};
