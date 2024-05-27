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

/**
 * Recursively descends into the data object and inflates any
 * `StoreDataCapabilityPart`, turning it into
 * `InlineDataCapabilityPart`.
 * @param data -- data to inflate
 * @returns -- a new object with all `StoredDataCapabilityPart`
 * replaced with `InlineDataCapabilityPart`
 */
export const inflateData = async (data: unknown) => {
  const descender = async (value: unknown): Promise<unknown> => {
    if (isStoredData(value)) {
      const { mimeType, handle } = value.storedData;
      const blob = await (await fetch(handle)).blob();
      const data = await asBase64(blob);
      return { inlineData: { data, mimeType } };
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value) {
        result.push(await descender(item));
      }
      return result;
    }
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key in value) {
        result[key] = await descender(v[key]);
      }
      return result;
    }
    return value;
  };

  const result = await descender(data);
  return result;
};

/**
 * Recursively descends into the data object and deflates any
 * `InlineDataCapabilityPart`, turning it into
 * `StoredDataCapabilityPart`.
 * @param data -- data to deflate
 * @returns -- a new object with all `InlineDataCapabilityPart`
 * replaced with `StoredDataCapabilityPart`
 */
export const deflateData = async (data: unknown) => {
  const descender = async (value: unknown): Promise<unknown> => {
    if (isInlineData(value)) {
      const { mimeType, data } = value.inlineData;
      const blob = await fetch(`data:${mimeType};base64,${data}`).then((r) =>
        r.blob()
      );
      const handle = URL.createObjectURL(blob);
      return {
        storedData: {
          handle,
          mimeType,
        },
      };
    }
    if (Array.isArray(value)) {
      const result = [];
      for (const item of value) {
        result.push(await descender(item));
      }
      return result;
    }
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const key in value) {
        result[key] = await descender(v[key]);
      }
      return result;
    }
    return value;
  };

  const result = await descender(data);
  return result;
};
