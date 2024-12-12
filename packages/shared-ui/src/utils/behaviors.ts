/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";

export function isBoardBehavior(schema: Schema): boolean {
  return schema.behavior?.includes("board") ?? false;
}

export function isBoardArrayBehavior(schema: Schema): boolean {
  if (schema.type !== "array") return false;
  if (!schema.items) return false;
  if (Array.isArray(schema.items)) return false;
  if (!schema.items.behavior) return false;
  return schema.items.behavior?.includes("board") ?? false;
}

export function isPortSpecBehavior(schema: Schema): boolean {
  return schema.behavior?.includes("ports-spec") ?? false;
}

export function isCodeBehavior(schema: Schema): boolean {
  return schema.behavior?.includes("code") ?? false;
}

export function isLLMContentBehavior(schema: Schema): boolean {
  return schema.behavior?.includes("llm-content") ?? false;
}

export function isModuleBehavior(schema: Schema): boolean {
  return schema.behavior?.includes("module") ?? false;
}

export function isConfigurableBehavior(schema: Schema): boolean {
  return schema.behavior?.includes("config") ?? false;
}

export function isLLMContentArrayBehavior(schema: Schema): boolean {
  if (schema.type !== "array") return false;
  if (Array.isArray(schema.items)) return false;
  if (schema.items?.type !== "object") return false;
  if (!schema.items?.behavior?.includes("llm-content")) return false;

  return true;
}

export function isTextBehavior(schema: Schema): boolean {
  return schema.type === "string";
}

export function behaviorsMatch(schema1: Schema, schema2: Schema): boolean {
  if (schema1.behavior?.length !== schema2.behavior?.length) {
    return false;
  }

  if (JSON.stringify(schema1.behavior) !== JSON.stringify(schema2.behavior)) {
    return false;
  }

  return true;
}
