/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FunctionCallCapabilityPart,
  FunctionResponseCapabilityPart,
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
  TextCapabilityPart,
} from "./types.js";
import { DataCapability } from "../types.js";

// Helpers for handling DataCapability objects.

export function isTextCapabilityPart(
  part: unknown
): part is TextCapabilityPart {
  if (typeof part !== "object" || part === null) return false;
  return "text" in part;
}

export function isFunctionCallCapabilityPart(
  part: unknown
): part is FunctionCallCapabilityPart {
  if (typeof part !== "object" || part === null) return false;
  return "functionCall" in part;
}

export function isFunctionResponseCapabilityPart(
  part: unknown
): part is FunctionResponseCapabilityPart {
  if (typeof part !== "object" || part === null) return false;
  return "functionResponse" in part;
}

export function isLLMContent(nodeValue: unknown): nodeValue is LLMContent {
  if (typeof nodeValue !== "object" || !nodeValue) return false;

  return (
    "parts" in nodeValue &&
    Array.isArray(nodeValue.parts) &&
    "role" in nodeValue
  );
}

export const isDataCapability = (value: unknown): value is DataCapability => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (data.kind !== "data") return false;
  if ("inlineData" in data) return true;
  if ("storedData" in data) return true;
  return false;
};

export const asBlob = async (
  part: InlineDataCapabilityPart | StoredDataCapabilityPart
) => {
  let url: string;
  if (isStoredData(part)) {
    url = part.storedData.handle;
  } else {
    url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  const response = await fetch(url);
  const data = await response.blob();
  return data;
};

export const isStoredData = (
  value: unknown
): value is StoredDataCapabilityPart => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (!("storedData" in data)) return false;
  if (typeof data.storedData.handle !== "string") return false;
  return true;
};

export const isInlineData = (
  value: unknown
): value is InlineDataCapabilityPart => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (!("inlineData" in data)) return false;
  if (typeof data.inlineData.data !== "string") return false;
  return true;
};

export const isSerializedData = (
  value: unknown
): value is InlineDataCapabilityPart => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (!("inlineData" in data)) return false;
  if (!("handle" in data)) return false;
  if (typeof data.inlineData.data !== "string") return false;
  return true;
};

export async function asBase64(file: File | Blob): Promise<string> {
  if ("Buffer" in globalThis) {
    // Node.js implementation, since Node.js doesn't have FileReader.
    return Buffer.from(await file.arrayBuffer()).toString("base64");
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject("Reader result is not a string");
          return;
        }

        const [, content] = reader.result.split(",");
        resolve(content);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}
