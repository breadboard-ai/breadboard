/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileDataPart, JSONPart, LLMContent } from "@breadboard-ai/types";
import { OutputValues, Schema } from "@google-labs/breadboard";

export {
  getParticleStreamHandle,
  idFromPath,
  isParticleMode,
  toJson,
  toLLMContentArray,
  getFirstFileDataPart,
};

const REPORT_STREAM_MIME_TYPE = "application/vnd.breadboard.report-stream";

export type Products = {
  products: Record<string, LLMContent>;
  chat: boolean;
  particleMode: boolean;
};

function idFromPath(path: number[]): string {
  return `e-${path.join("-")}`;
}

function getParticleStreamHandle(
  schema: Schema,
  values: OutputValues
): string | null {
  const firstProperty = Object.entries(schema.properties || {}).at(0);
  if (!firstProperty) return null;
  const [name, propertySchema] = firstProperty;
  if (!propertySchema?.behavior?.includes("llm-content")) {
    return null;
  }
  const value = values[name] as LLMContent;
  if (!value) return null;
  const part = getFirstFileDataPart(value);
  if (part?.fileData.mimeType !== REPORT_STREAM_MIME_TYPE) return null;
  return part?.fileData.fileUri;
}

function isParticleMode(schema: Schema, values: OutputValues) {
  const firstProperty = Object.entries(schema.properties || {}).at(0);
  if (!firstProperty) return false;
  const [name, propertySchema] = firstProperty;
  if (!propertySchema?.behavior?.includes("llm-content")) {
    return false;
  }
  const value = values[name] as LLMContent;
  if (!value) return false;
  const part = getFirstFileDataPart(value);
  return part?.fileData.mimeType === REPORT_STREAM_MIME_TYPE;
}

function toLLMContentArray(schema: Schema, values: OutputValues): Products {
  let chat = false;
  if (!schema.properties) {
    // No schema, so let's just stringify and stuff outputs into json part.
    const products = Object.fromEntries(
      Object.entries(values).map(([name, value]) => {
        return [name, asJson(value)];
      })
    );
    return { products, chat, particleMode: false };
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
      const llmContent = value as LLMContent;
      products[name] = llmContent;
      const particleMode =
        getFirstFileDataPart(llmContent)?.fileData.mimeType ===
        REPORT_STREAM_MIME_TYPE;
      if (particleMode) {
        // This is particle mode, return early and discard all other values.
        return {
          products: { [name]: llmContent },
          chat,
          particleMode: true,
        };
      }
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
  return { products, chat, particleMode: false };

  function asJson(value: unknown): LLMContent {
    return { parts: [{ json: JSON.stringify(value, null, 2) }] };
  }
}

function getFirstFileDataPart(content: LLMContent): FileDataPart | null {
  try {
    const first = content.parts.at(0);
    if (!first || !("fileData" in first)) return null;
    return first;
  } catch {
    console.warn(`This is likely not LLMContent`, content);
  }
  return null;
}
function toJson(content: LLMContent[] | undefined): unknown | undefined {
  return (content?.at(0)?.parts.at(0) as JSONPart)?.json;
}
