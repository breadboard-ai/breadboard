/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FunctionCallCapabilityPart,
  FunctionResponseCapabilityPart,
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
  TextCapabilityPart,
} from "@breadboard-ai/types";
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
  if (nodeValue === null || nodeValue === undefined) return false;

  return "parts" in nodeValue && Array.isArray(nodeValue.parts);
}

export function isLLMContentArray(
  nodeValue: unknown
): nodeValue is LLMContent[] {
  if (typeof nodeValue !== "object" || !nodeValue) return false;
  if (!Array.isArray(nodeValue)) return false;
  if (nodeValue === null || nodeValue === undefined) return false;

  nodeValue = nodeValue.filter((item) => {
    if (item === null || item === undefined) return false;
    return item.role !== "$metadata";
  });

  return (
    Array.isArray(nodeValue) && nodeValue.every((entry) => isLLMContent(entry))
  );
}

export function isMetadataEntry(nodeValue: LLMContent) {
  return nodeValue.role === "$metadata";
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

export async function retrieveAsBlob(
  part: StoredDataCapabilityPart
): Promise<Blob> {
  if (!isStoredData(part)) {
    throw new Error("Invalid stored data");
  }

  const { handle } = part.storedData;
  const response = await fetch(handle);
  return await response.blob();
}

export async function toInlineDataPart(
  part: StoredDataCapabilityPart
): Promise<InlineDataCapabilityPart> {
  const raw = await retrieveAsBlob(part);
  const mimeType = part.storedData.mimeType;
  const data = await asBase64(raw);
  return { inlineData: { mimeType, data } };
}

export async function toStoredDataPart(
  part: InlineDataCapabilityPart | StoredDataCapabilityPart | Blob
): Promise<StoredDataCapabilityPart> {
  if (isStoredData(part)) {
    if (part.storedData.handle.startsWith("https://")) {
      return part;
    }
  }
  const blob = part instanceof Blob ? part : await asBlob(part);
  const handle = URL.createObjectURL(blob);

  return {
    storedData: {
      handle,
      mimeType: blob.type,
    },
  };
}
