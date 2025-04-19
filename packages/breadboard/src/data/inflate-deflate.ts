/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InlineDataCapabilityPart, LLMContent } from "@breadboard-ai/types";
import {
  asBase64,
  asBlob,
  isFileDataCapabilityPart,
  isInlineData,
  isStoredData,
  maybeGetExecutionOutputs,
  transformDataParts,
} from "./common.js";
import {
  BlobDataStore,
  Chunk,
  DataInflator,
  DataPartTransformType,
  DataStore,
  Outcome,
  SerializedDataStoreGroup,
  StepContent,
} from "./types.js";
import { ok } from "./file-system/utils.js";

export { transformContents };

async function transformContents(
  store: DataInflator,
  content: LLMContent[],
  type: DataPartTransformType,
  graphUrl: URL
): Promise<Outcome<LLMContent[]>> {
  const transformer = store.transformer?.(graphUrl);
  if (!transformer) return content;

  // TODO: Implement support for other types.
  if (type !== "persistent-temporary") return content;

  const transforming = await transformDataParts(
    graphUrl,
    content,
    type,
    transformer
  );
  if (!ok(transforming)) return transforming;

  return transforming;
}

/**
 * Recursively descends into the data object and inflates any
 * `StoreDataCapabilityPart`, turning it into
 * `InlineDataCapabilityPart`.
 * @param data -- data to inflate
 * @returns -- a new object with all `StoredDataCapabilityPart`
 * replaced with `InlineDataCapabilityPart`
 */
export const inflateData = async (
  store: DataInflator,
  data: unknown,
  graphUrl?: URL,
  inflateToFileData?: boolean
) => {
  const descender = async (value: unknown): Promise<unknown> => {
    if (isFileDataCapabilityPart(value)) {
      if (inflateToFileData && store.transformer && graphUrl) {
        if (inflateToFileData && store.transformer && graphUrl) {
          const contents: LLMContent[] = [{ parts: [value] }];
          const transformer = store.transformer(graphUrl);
          if (transformer) {
            const transforming = await transformDataParts(
              graphUrl,
              contents,
              "file",
              transformer
            );
            if (ok(transforming)) {
              const part = transforming.at(0)?.parts.at(0);
              if (part) return part;
            }
          }
        }
      }
    } else if (isStoredData(value)) {
      if (
        value.storedData.handle.startsWith("https://") ||
        value.storedData.handle.startsWith("http://")
      ) {
        return value;
      }
      if (inflateToFileData && store.transformer && graphUrl) {
        const contents: LLMContent[] = [{ parts: [value] }];
        const transformer = store.transformer(graphUrl);
        if (transformer) {
          const transforming = await transformDataParts(
            graphUrl,
            contents,
            "file",
            transformer
          );
          if (ok(transforming)) {
            const part = transforming.at(0)?.parts.at(0);
            if (part) return part;
          }
        }
      }
      const blob = await store.retrieveAsBlob(value, graphUrl);
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

export const blobifyStepOutputs = async (store: DataStore, data: unknown) => {
  const result = data;
  const executionOutputs = maybeGetExecutionOutputs(data);
  if (!executionOutputs) {
    return result;
  }
  for (const key of Object.keys(executionOutputs)) {
    const blobStore = store as BlobDataStore;
    const output = executionOutputs[key] as StepContent;
    const newChunks: Chunk[] = [];
    for (const chunk of output.chunks) {
      if (chunk.mimetype.startsWith("text/gcs-path")) {
        // The executeStep API returns a mime like: text/gcs-path/real/mimetype.
        const mimetype = chunk.mimetype.replace("text/gcs-path/", "");
        // The executeStep API returns a path like: bucketname/filename.
        const blobId = atob(chunk.data).split("/").slice(-1)[0];
        const blobUrl = blobStore.toBlobUrl(blobId);
        newChunks.push({
          mimetype: mimetype + "/storedData",
          data: blobUrl,
        } as Chunk);
      } else {
        newChunks.push(chunk);
      }
    }
    executionOutputs[key] = {
      chunks: newChunks,
    };
  }
  return result;
};

export function maybeAddGcsOutputConfig(data: unknown): unknown {
  const apiRequiresGcs: string[] = [
    "image_generation",
    "tts",
    "generate_video",
  ];
  if (data === null || typeof data !== "object" || !("body" in data)) {
    return data;
  }
  const body = data.body as Record<string, unknown>;
  if (body === null || typeof body !== "object" || !("planStep" in body)) {
    return data;
  }
  const planStep = body.planStep as Record<string, unknown>;
  const modelApi = planStep["modelApi"] as string;
  if (!apiRequiresGcs.includes(modelApi)) {
    return data;
  }
  // TODO(askerryryan): Stop hard-coding this and derive programmatically.
  const gcsOutputConfig = {
    bucket_name: "bb-blob-store",
  };
  body["output_gcs_config"] = gcsOutputConfig;
  console.log("Set GCS output config: ", gcsOutputConfig);
  return data;
}
