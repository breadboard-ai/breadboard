/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeHandlerContext,
  OutputValues,
} from "@google-labs/breadboard";

export default async (
  inputs: InputValues,
  context: NodeHandlerContext
): Promise<OutputValues> => {
  const base = inputs.$base ?? context.base?.href;
  if (!base) {
    throw new Error(
      `Resolve could not find a base URL. The $base input was undefined, ` +
        `and so was the handler context base.`
    );
  }
  if (typeof base !== "string") {
    throw new Error(`Resolve base must be a string, got ${typeof base}.`);
  }
  const resolved: Record<string, string> = {};
  for (const [name, value] of Object.entries(inputs)) {
    if (name === "$base") {
      continue;
    }
    if (typeof value !== "string") {
      throw new Error(
        `Resolve requires string inputs. Input "${name}" had type "${typeof value}".`
      );
    }
    resolved[name] = new URL(value, base).href;
  }
  return resolved;
};
