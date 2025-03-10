/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type NodeValue,
  type Schema,
  type UnresolvedPathBoardCapability,
} from "@google-labs/breadboard";

export const isBoardBehavior = (
  schema: Schema,
  value: NodeValue
): value is UnresolvedPathBoardCapability | string | undefined => {
  if (!schema.behavior?.includes("board")) return false;
  if (!value) return true;
  if (typeof value === "string") return true;
  if (typeof value === "object") {
    const maybeCapability = value as UnresolvedPathBoardCapability;
    return maybeCapability.kind === "board" && !!maybeCapability.path;
  }
  return false;
};

export function isPortSpecBehavior(schema: Schema) {
  return schema.behavior?.includes("ports-spec");
}

export function isCodeBehavior(schema: Schema) {
  return schema.behavior?.includes("hint-code");
}

export function isLLMContentBehavior(schema: Schema) {
  return schema.behavior?.includes("llm-content");
}

export function isLLMContentArrayBehavior(schema: Schema) {
  if (schema.type !== "array") return false;
  if (Array.isArray(schema.items)) return false;
  if (schema.items?.type !== "object") return false;
  if (!schema.items?.behavior?.includes("llm-content")) return false;

  return true;
}

export function isImageURL(
  nodeValue: unknown
): nodeValue is { image_url: string } {
  if (typeof nodeValue !== "object" || !nodeValue) {
    return false;
  }

  return "image_url" in nodeValue;
}
