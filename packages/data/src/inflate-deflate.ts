/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { isStoredData } from "@breadboard-ai/utils";

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
const visitGraphNodes = async (
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
