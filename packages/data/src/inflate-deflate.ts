/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataDeflator,
  DataInflator,
  DataPartTransformType,
  DataStore,
  GraphDescriptor,
  InlineDataCapabilityPart,
  LLMContent,
  Outcome,
  SerializedDataStoreGroup,
} from "@breadboard-ai/types";
import {
  asBase64,
  asBlob,
  isFileDataCapabilityPart,
  isInlineData,
  isStoredData,
  ok,
  transformDataParts,
} from "@breadboard-ai/utils";

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
  return visitGraphNodes(data, async (value) => {
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
            } else {
              throw new Error(transforming.$error);
            }
          }
        }
      }
    } else if (isStoredData(value)) {
      if (
        (value.storedData.handle.startsWith("https://") ||
          value.storedData.handle.startsWith("http://")) &&
        !inflateToFileData
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
    return value;
  });
};

/**
 * Recursively descends into the data object and deflates any
 * `InlineDataCapabilityPart`, turning it into
 * `StoredDataCapabilityPart`.
 * @param data -- data to deflate
 * @returns -- a new object with all `InlineDataCapabilityPart`
 * replaced with `StoredDataCapabilityPart`
 */
export const deflateData = async (deflator: DataDeflator, data: unknown) => {
  return visitGraphNodes(data, async (value) => {
    if (isStoredData(value) && value.storedData.handle) {
      // Deleting stored value, for sanity, checking if the handle is assigned.
      delete value.data;
    }
    if (isInlineData(value)) {
      const { mimeType, data } = value.inlineData;
      const blob = await fetch(`data:${mimeType};base64,${data}`).then((r) =>
        r.blob()
      );
      return await deflator.store(blob);
    }
    return value;
  });
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

  return visitGraphNodes(o, async (value) => {
    if (isStoredData(value)) {
      const { handle } = value.storedData;
      const serialized = handleMap.get(handle);
      if (!serialized) {
        throw new Error(`Could not find serialized data for handle: ${handle}`);
      }
      const blob = await asBlob(serialized);
      return store.store(blob);
    }
    return value;
  });
};

/** Deletes all .data value from StoredDataCapabilityPart. */
export const purgeStoredDataInMemoryValues = async (graph: GraphDescriptor) => {
  return visitGraphNodes(graph, (node: unknown) => {
    if (isStoredData(node)) {
      if (node.data && node.storedData.handle) {
        delete node.data;
      }
    }
    return node;
  });
};

/**
 * Generic walking mechanism for graphs (Visitor pattern).
 * It applies elementMapper to nodes in parallel while walking down level by level (BFS).
 * This method is using similar process to walking through the graph like `descender()` above, with the 2 differences:
 *   1. Processing the data in parallel vs 1 by 1.
 *   2. Decouples the walking logic from the actual domain specific transformation logic.
 */
export const visitGraphNodes = async (
  graph: unknown,
  nodeMapper: (data: unknown) => unknown
): Promise<unknown> => {
  const bfsWalker = async (value: unknown): Promise<unknown> => {
    value = await nodeMapper(value); // Apply the walker before, then apply every element of it as well.
    if (Array.isArray(value)) {
      const promises = value.map((element: unknown): Promise<unknown> => {
        // Do not await - the promise is returned on purpose.
        const mappedElement = nodeMapper(element);
        return bfsWalker(mappedElement);
      });
      return await Promise.all(promises);
    }
    if (typeof value === "object" && value !== null) {
      // Ideally we should be applying the mapper to every level.
      // However this blows the current setup up for a content coming from A2, hence for backward
      // compatibility leaving this line commented out.
      // TODO(volodya): Figure out if this needs to be refactored at the higher level.
      // const v = (await nodeMapper(value)) as Record<string, unknown>;
      const v = value as Record<string, unknown>;
      const promises: Array<Promise<[string, unknown]>> = [];
      for (const key in value) {
        const mappedValue = nodeMapper(v[key]);
        const promise = bfsWalker(mappedValue);
        promises.push(promise.then((value) => [key, value]));
      }
      const resolvedValues = await Promise.all(promises);
      const result: Record<string, unknown> = {};
      for (const [key, mappedValue] of resolvedValues) {
        result[key] = mappedValue;
      }
      return result;
    }
    const mappedValue = await nodeMapper(value);
    return mappedValue;
  };

  return bfsWalker(graph);
};
