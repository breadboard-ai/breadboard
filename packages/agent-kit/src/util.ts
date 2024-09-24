/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LlmContent } from "./context.js";

export function unique<T>(params: T[]): T[] {
  return Array.from(new Set(params));
}

export function toId(param: string) {
  return `p-${param}`;
}

export function isEmptyContent(
  content: LlmContent | string | undefined
): content is undefined {
  if (!content) return true;
  if (typeof content === "string") return true;
  if (!content.parts?.length) return true;
  if (content.parts.length > 1) return false;
  const part = content.parts[0];
  if (!("text" in part)) return true;
  if (part.text.trim() === "") return true;
  return false;
}

/**
 * Copied from @google-labs/breadboard
 */
export function isLLMContent(nodeValue: unknown): nodeValue is LlmContent {
  if (typeof nodeValue !== "object" || !nodeValue) return false;
  if (nodeValue === null || nodeValue === undefined) return false;

  if ("role" in nodeValue && nodeValue.role === "$metadata") {
    return true;
  }

  return "parts" in nodeValue && Array.isArray(nodeValue.parts);
}

export function isLLMContentArray(nodeValue: unknown): nodeValue is LlmContent[] {
  if (!Array.isArray(nodeValue)) return false;
  if (nodeValue.length === 0) return true;
  return isLLMContent(nodeValue.at(-1));
}

export function toTitle(id: string) {
  const spaced = id?.replace(/[_-]/g, " ");
  return (
    (spaced?.at(0)?.toUpperCase() ?? "") +
    (spaced?.slice(1)?.toLowerCase() ?? "")
  );
}
