/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  JsonSerializable,
  NodeConfiguration,
} from "@breadboard-ai/types";
import type { ChangeConfigurationSpec } from "@google-labs/breadboard";

export function findConfigurationChanges(
  oldFlow: GraphDescriptor,
  newFlow: GraphDescriptor
): Array<Omit<ChangeConfigurationSpec, "graphId">> {
  const newConfigs = new Map<string, NodeConfiguration | undefined>();
  for (const newStep of newFlow.nodes) {
    newConfigs.set(newStep.id, newStep.configuration);
  }
  const changes: Array<Omit<ChangeConfigurationSpec, "graphId">> = [];
  for (const oldStep of oldFlow.nodes) {
    const oldConfig = oldStep.configuration ?? null;
    const newConfig = newConfigs.get(oldStep.id) ?? null;
    if (
      newConfig &&
      !jsonEqual(oldConfig as JsonSerializable, newConfig as JsonSerializable)
    ) {
      changes.push({
        type: "changeconfiguration",
        id: oldStep.id,
        configuration: newConfig,
        reset: true,
      });
    }
  }
  return changes;
}

function jsonEqual(a: JsonSerializable, b: JsonSerializable): boolean {
  if (
    a === null ||
    typeof a === "string" ||
    typeof a === "number" ||
    typeof a === "boolean"
  ) {
    return a === b;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!jsonEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (typeof a === "object") {
    if (b === null || typeof b !== "object") {
      return false;
    }
    for (const [key, valA] of Object.entries(a)) {
      const valB = (b as Record<string, JsonSerializable | undefined>)[key];
      if (valB === undefined || !jsonEqual(valA, valB)) {
        return false;
      }
    }
    for (const key of Object.keys(b)) {
      if (!Object.hasOwn(a, key)) {
        return false;
      }
    }
    return true;
  }

  throw new Error(`"Not a valid JSON value: <${typeof a}>`, a satisfies never);
}
