/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileDataPart,
  JsonSerializable,
  JSONPart,
  LLMContent,
  OutputValues,
  Schema,
} from "@breadboard-ai/types";
import { getLogger, Formatter } from "./logging/logger.js";

export { idFromIndex, toJson, toLLMContentArray, getFirstFileDataPart };

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type Products = {
  products: Record<string, LLMContent>;
};

/**
 * Creates a unique string key from a node invocation index.
 */
function idFromIndex(index: string): string {
  return `e-${index}`;
}

function toLLMContentArray(schema: Schema, values: OutputValues): Products {
  if (!schema.properties) {
    // No schema, so let's just stringify and stuff outputs into json part.
    const products = Object.fromEntries(
      Object.entries(values).map(([name, value]) => {
        return [name, asJson(value)];
      })
    );
    return { products };
  }

  const products: Record<string, LLMContent> = {};
  for (const [name, propertySchema] of Object.entries(schema.properties)) {
    const value = values[name];
    if (!value) {
      getLogger().log(
        Formatter.warning(
          `Schema specifies property "${name}", but it wasn't supplied`
        ),
        "toLLMContentArray"
      );
      continue;
    }
    if (propertySchema.type === "array") {
      const items = propertySchema.items as Schema;
      if (items.behavior?.includes("llm-content")) {
        // This is an LLMContent array. By convention, we only take the first
        // item.
        if (Array.isArray(value) && value.length > 0) {
          products[name] = value.at(0) as LLMContent;
          continue;
        }
      }
    } else if (
      propertySchema.type === "object" &&
      propertySchema.behavior?.includes("llm-content")
    ) {
      // This is an LLMContent.
      const llmContent = value as LLMContent;
      products[name] = llmContent;
      continue;
    } else if (
      propertySchema.type === "string" ||
      propertySchema.type === "number" ||
      propertySchema.type === "boolean"
    ) {
      products[name] = { parts: [{ text: `${value}` }] };
      continue;
    }
    // Everything else, let's stringify and stuff outputs as json part.
    products[name] = asJson(value);
  }
  return { products };

  function asJson(value: unknown): LLMContent {
    return { parts: [{ json: value as JsonSerializable }] };
  }
}

function getFirstFileDataPart(content: LLMContent): FileDataPart | null {
  try {
    const first = content.parts.at(0);
    if (!first || !("fileData" in first)) return null;
    return first;
  } catch {
    getLogger().log(
      Formatter.warning(`This is likely not LLMContent`),
      "getFirstFileDataPart"
    );
  }
  return null;
}
function toJson(content: LLMContent[] | undefined): unknown | undefined {
  return (content?.at(0)?.parts.at(0) as JSONPart)?.json;
}
