/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineDataCapabilityPart, StoredDataCapabilityPart } from "./types.js";
import { DataCapability } from "../types.js";

// Helpers for handling DataCapability objects.

export const isDataCapability = (value: unknown): value is DataCapability => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
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
  if (!data.storedData.handle) return false;
  return true;
};

export const isInlineData = (
  value: unknown
): value is InlineDataCapabilityPart => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (!("inlineData" in data)) return false;
  if (!data.inlineData.data) return false;
  return true;
};

export function asBase64(file: File | Blob): Promise<string> {
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
