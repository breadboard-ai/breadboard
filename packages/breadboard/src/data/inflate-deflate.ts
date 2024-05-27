/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asBase64, isInlineData, isStoredData } from "./common.js";

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
