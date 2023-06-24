/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "../graph.js";

export interface CustomNodeManager {
  [key: string]: (...args: string[]) => Promise<OutputValues>;
}

export const customNode =
  (managerish: object) => async (inputs?: InputValues) => {
    const manager = managerish as CustomNodeManager;
    if (!inputs) throw new Error("Custom node requires inputs");
    const method = inputs["method"] as string;
    if (!method) throw new Error("Custom node requires `method` input");
    const argNames = (inputs["args"] ?? []) as string[];
    const args = argNames.map((argName) => inputs[argName] as string);
    return await manager[method](...args);
  };
