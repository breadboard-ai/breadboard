/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Summarizes an LLM content value into a short preview string.
 *
 * Déjà Code — extracted from the identical pattern in create-chiclets.ts
 * and create-truncated-value.ts. Both files independently implemented the
 * same 20-line normalize → extract firstPart → branch on type logic.
 *
 * The pattern:
 *   1. Normalize LLMContent to LLMContent[] (wrap single in array)
 *   2. Grab the first value's first part
 *   3. Branch: text → text content, inlineData → mimeType, storedData → mimeType
 *   4. Fall back to generic labels for other part types or empty arrays
 */

import type { LLMContent, NodeValue } from "@breadboard-ai/types";
import { isStoredData } from "@breadboard-ai/utils";
import {
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
} from "../data/common.js";

export { summarizeLLMContentValue };

/**
 * Summarize an LLM content value into a short human-readable string.
 *
 * Handles both `LLMContent` and `LLMContent[]` inputs. Returns a summary
 * based on the first part of the first content entry:
 *  - Text parts → the text content (or "(empty text)" if blank)
 *  - Inline data → the MIME type
 *  - Stored data → the MIME type
 *  - Other → "LLM Content Part"
 *  - Empty array → "0 items"
 *
 * Returns `null` if the value is not LLM content.
 */
function summarizeLLMContentValue(
  value: NodeValue,
  emptyTextLabel = "(empty text)"
): string | null {
  if (typeof value !== "object" || value === null || value === undefined) {
    return null;
  }

  // Normalize single LLMContent to array form.
  if (isLLMContent(value)) {
    value = [value];
  }

  if (!isLLMContentArray(value)) {
    return null;
  }

  const firstValue = (value as LLMContent[])[0];
  if (!firstValue) {
    return "0 items";
  }

  const firstPart = firstValue.parts[0];
  if (isTextCapabilityPart(firstPart)) {
    return firstPart.text === "" ? emptyTextLabel : firstPart.text;
  } else if (isInlineData(firstPart)) {
    return firstPart.inlineData.mimeType;
  } else if (isStoredData(firstPart)) {
    return firstPart.storedData.mimeType;
  }

  return "LLM Content Part";
}
