/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  createDefaultDataStore,
  isInlineData,
  isLLMContent,
  isStoredData,
  StoredDataCapabilityPart,
} from "../../src/index.js";
import { HarnessRunResult } from "../../src/harness/types.js";

const inputResult: HarnessRunResult = {
  type: "nodeend",
  data: {
    node: {
      id: "input-45dd0a3d",
      type: "input",
    },
    inputs: {},
    path: [],
    timestamp: 10,
    outputs: {
      content: {
        role: "user",
        parts: [
          {
            inlineData: {
              data: "aabbcc",
              mimeType: "text/plain",
            },
          },
        ],
      },
    },
  },
  async reply() {},
};

function copyResult(result: HarnessRunResult): HarnessRunResult {
  // We can't use structuredClone because of the async function, so we fall back
  // to using parse/stringify to make a copy.
  return JSON.parse(JSON.stringify(result));
}

test("Default Data Store replaces inline data parts", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResult);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContent(property)) {
      continue;
    }

    for (const part of property.parts) {
      t.truthy(isInlineData(part));
    }
  }

  await store.replaceDataParts("store", result);

  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContent(property)) {
      continue;
    }

    for (const part of property.parts) {
      t.truthy(isStoredData(part));
    }
  }

  store.releaseAll();
});

test("Default Data Store replaces stored data parts", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResult);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  await store.replaceDataParts("store", result);

  const handles: string[] = [];
  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContent(property)) {
      continue;
    }

    for (const part of property.parts) {
      t.truthy(isStoredData(part));
      const storedPart = part as StoredDataCapabilityPart;
      handles.push(storedPart.storedData.handle);
    }
  }

  // Replace again, and confirm we have different blob URLs.
  await store.replaceDataParts("store", result);
  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContent(property)) {
      continue;
    }

    for (let i = 0; i < property.parts.length; i++) {
      const part = property.parts[i];
      t.truthy(isStoredData(part));
      const storedPart = part as StoredDataCapabilityPart;
      t.notDeepEqual(handles[i], storedPart.storedData.handle);
    }
  }

  store.releaseAll();
});

test("Default Data Store releases groups", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResult);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  await store.replaceDataParts("store", result);
  await store.replaceDataParts("store2", result);
  store.releaseGroup("store");
  t.falsy(store.has("store"));

  store.releaseAll();
  t.falsy(store.has("store2"));
});

test("Default Data Store serializes groups", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResult);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  await store.replaceDataParts("store", result);
  const serialized = await store.serializeGroup("store");
  console.log(serialized);

  t.deepEqual(serialized?.length, 1);
  t.truthy(serialized![0].handle);
  t.deepEqual(serialized![0].inlineData, {
    data: "aabbcQ==",
    mimeType: "text/plain",
  });

  store.releaseAll();
});
