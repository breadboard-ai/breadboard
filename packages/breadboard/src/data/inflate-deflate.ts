/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineDataCapabilityPart } from "@breadboard-ai/types";
import { asBase64, asBlob, isInlineData, isStoredData } from "./common.js";
import { DataStore, SerializedDataStoreGroup } from "./types.js";

/**
 * Recursively descends into the data object and inflates any
 * `StoreDataCapabilityPart`, turning it into
 * `InlineDataCapabilityPart`.
 * @param data -- data to inflate
 * @returns -- a new object with all `StoredDataCapabilityPart`
 * replaced with `InlineDataCapabilityPart`
 */
export const inflateData = async (store: DataStore, data: unknown) => {
  const descender = async (value: unknown): Promise<unknown> => {
    if (isStoredData(value)) {
      const blob = await store.retrieveAsBlob(value);
      const data = await asBase64(blob);
      const mimeType = blob.type;
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
export const deflateData = async (store: DataStore, data: unknown) => {
  const descender = async (value: unknown): Promise<unknown> => {
    if (isInlineData(value)) {
      const { mimeType, data } = value.inlineData;
      const blob = await fetch(`data:${mimeType};base64,${data}`).then((r) =>
        r.blob()
      );
      return await store.store(blob);
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
 * Recursively descends into the data object and replaces any
 * instances of `StoredDataCapabilityPart` with another `StoredDataCapabilityPart`, using `SerializedDataStoreGroup` to map between the two.
 */
export const remapData = async (
  store: DataStore,
  o: unknown,
  serializedData: SerializedDataStoreGroup
) => {
  const handleMap = new Map<string, InlineDataCapabilityPart>();
  for (const item of serializedData) {
    const { handle } = item;
    handleMap.set(handle, item);
  }
  const descender = async (value: unknown): Promise<unknown> => {
    if (isStoredData(value)) {
      const { handle } = value.storedData;
      const serialized = handleMap.get(handle);
      if (!serialized) {
        throw new Error(`Could not find serialized data for handle: ${handle}`);
      }
      const blob = await asBlob(serialized);
      return store.store(blob);
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

  const result = await descender(o);
  return result;
};
