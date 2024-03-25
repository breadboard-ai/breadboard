/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BehaviorSchema, Schema } from "@google-labs/breadboard";

interface Items {
  type?: string;
  behavior: BehaviorSchema[];
}

export function resolveArrayType(value: Schema) {
  if (value.items) {
    const valueItems = value.items as Items;
    if (valueItems.type) {
      return valueItems.type;
    } else if (resolveBehaviorType(valueItems) === "llm-content") {
      return "object";
    }
  } else if (resolveBehaviorType(value) === "llm-content") {
    return "object";
  }

  return "string";
}

export function resolveBehaviorType(value: Schema | Items) {
  if (value.behavior) {
    if (Array.isArray(value.behavior) && value.behavior.length > 0) {
      return value.behavior[0];
    } else {
      return value.behavior;
    }
  }

  return null;
}
