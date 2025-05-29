/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { OutputValues, Schema } from "@google-labs/breadboard";

export { toLLMContentArray, idFromPath };

function idFromPath(path: number[]): string {
  return `e-${path.join("-")}`;
}

function toLLMContentArray(
  schema: Schema,
  values: OutputValues
): { products: Record<string, LLMContent>; chat: boolean } {
  let chat = false;
  if (!schema.properties) {
    // No schema, so let's just stringify and stuff outputs into json part.
    const products = Object.fromEntries(
      Object.entries(values).map(([name, value]) => {
        return [name, asJson(value)];
      })
    );
    return { products, chat };
  }

  const products: Record<string, LLMContent> = {};
  for (const [name, propertySchema] of Object.entries(schema.properties)) {
    const value = values[name];
    if (!value) {
      console.warn(
        `Schema specifies property "${name}", but it wasn't supplied`
      );
      continue;
    }
    if (propertySchema.behavior?.includes("hint-chat-mode")) {
      chat = true;
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
      products[name] = value as LLMContent;
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
  return { products, chat };

  function asJson(value: unknown): LLMContent {
    return { parts: [{ json: JSON.stringify(value, null, 2) }] };
  }
}
