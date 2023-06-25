/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import { GraphContext, InputValues, OutputValues } from "../graph.js";
import { FollowContext } from "../runner.js";

class IncludeContext extends FollowContext {
  log: (s: string) => void;
  values: OutputValues = {};

  constructor(private inputs: InputValues, context: GraphContext) {
    super(context.handlers);
    this.log = context.log;
  }

  async requestExternalInput(_inputs: InputValues): Promise<OutputValues> {
    return this.inputs;
  }

  async provideExternalOutput(outputs: OutputValues): Promise<void> {
    this.values = outputs;
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
  const includeContext = new IncludeContext(args, context);
  await context.follow(includeContext, graph);
  return includeContext.values;
};
