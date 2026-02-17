/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { A2UIModelProcessor } from "../../data/model-processor.js";
import {
  BooleanValue,
  NumberValue,
  type StringValue,
} from "../../types/primitives.js";
import { type AnyComponentNode } from "../../types/types.js";

/**
 * Converts literal escape sequences (e.g. the two-character string `\n`)
 * into their corresponding whitespace characters.  Gemini-generated A2UI
 * payloads sometimes emit these as literal strings in `literalString` values.
 */
function unescapeLiteral(s: string): string {
  return s
    .replaceAll("\\n", "\n")
    .replaceAll("\\t", "\t")
    .replaceAll("\\r", "\r");
}

/**
 * Resolves a `StringValue` to a concrete string.
 *
 * Handles three cases:
 * - `literalString` / `literal`: returns the hardcoded string directly.
 * - `path`: resolves the data binding via `processor.getData()`.
 *
 * This is the recommended way to resolve `StringValue` in components and
 * custom elements, rather than inlining the resolution logic.
 */
export function extractStringValue(
  val: StringValue | null,
  component: AnyComponentNode | null,
  processor: A2UIModelProcessor | null,
  surfaceId: string | null
): string {
  if (val !== null && typeof val === "object") {
    if ("literalString" in val) {
      return unescapeLiteral(val.literalString ?? "");
    } else if ("literal" in val && val.literal !== undefined) {
      return unescapeLiteral(val.literal ?? "");
    } else if (val && "path" in val && val.path) {
      if (!processor || !component) {
        return "(no model)";
      }

      const textValue = processor.getData(
        component,
        val.path,
        surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
      );

      if (textValue === null || typeof textValue !== "string") {
        return "";
      }

      return textValue;
    }
  }

  return "";
}

/**
 * Resolves a `NumberValue` to a concrete number.
 *
 * Handles `literalNumber` / `literal` (direct) and `path` (data-bound) cases.
 * Returns `0` for null/missing values and `-1` for unresolvable paths.
 */
export function extractNumberValue(
  val: NumberValue | null,
  component: AnyComponentNode | null,
  processor: A2UIModelProcessor | null,
  surfaceId: string | null
): number {
  if (val !== null && typeof val === "object") {
    if ("literalNumber" in val) {
      return val.literalNumber ?? 0;
    } else if ("literal" in val && val.literal !== undefined) {
      return val.literal ?? 0;
    } else if (val && "path" in val && val.path) {
      if (!processor || !component) {
        return -1;
      }

      let numberValue = processor.getData(
        component,
        val.path,
        surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
      );

      if (typeof numberValue === "string") {
        numberValue = Number.parseInt(numberValue, 10);
        if (Number.isNaN(numberValue)) {
          numberValue = null;
        }
      }

      if (numberValue === null || typeof numberValue !== "number") {
        return -1;
      }

      return numberValue;
    }
  }

  return 0;
}

/**
 * Resolves a `BooleanValue` to a concrete boolean.
 *
 * Handles `literalBoolean` / `literal` (direct) and `path` (data-bound) cases.
 * When the bound value is a string, coerces `"true"` → `true` and everything
 * else → `false`. Returns `false` for null/missing/unresolvable values.
 */
export function extractBooleanValue(
  val: BooleanValue | null,
  component: AnyComponentNode | null,
  processor: A2UIModelProcessor | null,
  surfaceId: string | null
): boolean {
  if (val !== null && typeof val === "object") {
    if ("literalBoolean" in val) {
      return val.literalBoolean ?? false;
    } else if ("literal" in val && val.literal !== undefined) {
      return val.literal ?? false;
    } else if (val && "path" in val && val.path) {
      if (!processor || !component) {
        return false;
      }

      const boolValue = processor.getData(
        component,
        val.path,
        surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
      );

      if (typeof boolValue === "boolean") {
        return boolValue;
      }

      if (typeof boolValue === "string") {
        return boolValue === "true";
      }

      return false;
    }
  }

  return false;
}
