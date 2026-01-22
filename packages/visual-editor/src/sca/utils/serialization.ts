/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type SerilializedMap = {
  __type: "Map";
  value: [unknown, unknown][];
};
type SerilializedSet = {
  __type: "Set";
  value: unknown[];
};

type SerilializedMapSet = SerilializedMap | SerilializedSet;

export function jsonReplacer(_key: string, value: SerilializedMapSet) {
  if (value instanceof Map) {
    return { __type: "Map", value: Array.from(value.entries()) };
  }
  if (value instanceof Set) {
    return { __type: "Set", value: Array.from(value) };
  }
  return value;
}

export function jsonReviver(_key: string, value: SerilializedMapSet) {
  if (value && typeof value === "object" && value.__type === "Map") {
    return new Map(value.value);
  }
  if (value && typeof value === "object" && value.__type === "Set") {
    return new Set(value.value);
  }
  return value;
}
