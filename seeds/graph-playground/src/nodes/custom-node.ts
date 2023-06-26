/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphTraversalContext,
  InputValues,
  OutputValues,
} from "../types.js";

export interface CustomNodeManager {
  [key: string]: (...args: string[]) => Promise<OutputValues>;
}

export const customNode =
  (managerish: object) =>
  async (_cx: GraphTraversalContext, inputs: InputValues) => {
    const manager = managerish as CustomNodeManager;
    const method = inputs["method"] as string;
    if (!method) throw new Error("Custom node requires `method` input");
    const argNames = (inputs["args"] ?? []) as string[];
    const args = argNames.map((argName) => inputs[argName] as string);
    return await manager[method](...args);
  };
