/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type SerializedMap = {
  __type: "Map";
  value: [unknown, unknown][];
};
type SerializedSet = {
  __type: "Set";
  value: unknown[];
};

type SerializedMapSet = SerializedMap | SerializedSet;

export function jsonReplacer(_key: string, value: SerializedMapSet) {
  if (value instanceof Map) {
    return { __type: "Map", value: Array.from(value.entries()) };
  }
  if (value instanceof Set) {
    return { __type: "Set", value: Array.from(value) };
  }
  return value;
}

export function jsonReviver(_key: string, value: SerializedMapSet) {
  if (value && typeof value === "object" && value.__type === "Map") {
    return new Map(value.value);
  }
  if (value && typeof value === "object" && value.__type === "Set") {
    return new Set(value.value);
  }
  return value;
}
