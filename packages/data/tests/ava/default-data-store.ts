/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import type {
  HarnessRunResult,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import {
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
} from "@breadboard-ai/utils";
import { createDefaultDataStore } from "../../src/index.js";

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
    newOpportunities: [],
  },
  async reply() {},
};

const inputResultArray: HarnessRunResult = {
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
      content: [
        {
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
        {
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
      ],
    },
    newOpportunities: [],
  },
  async reply() {},
};

function copyResult(result: HarnessRunResult): HarnessRunResult {
  // We can't use structuredClone because of the async function, so we fall back
  // to using parse/stringify to make a copy.
  return JSON.parse(JSON.stringify(result));
}

test("Default Data Store replaces inline data parts for LLM Content", async (t) => {
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

  store.createGroup("store");
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

test("Default Data Store replaces inline data parts for LLM Content Arrays", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResultArray);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContentArray(property)) {
      continue;
    }

    for (const llmEntry of property) {
      for (const part of llmEntry.parts) {
        t.truthy(isInlineData(part));
      }
    }
  }

  store.createGroup("store");
  await store.replaceDataParts("store", result);

  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContentArray(property)) {
      continue;
    }

    for (const llmEntry of property) {
      for (const part of llmEntry.parts) {
        t.truthy(isStoredData(part));
      }
    }
  }

  store.releaseAll();
});

test("Default Data Store replaces stored data parts for LLM Content", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResult);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  store.createGroup("store");
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

test("Default Data Store replaces stored data parts for LLM Content Arrays", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResultArray);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  store.createGroup("store");
  await store.replaceDataParts("store", result);

  const handles: string[] = [];
  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContentArray(property)) {
      continue;
    }

    for (const llmEntry of property) {
      for (const part of llmEntry.parts) {
        t.truthy(isStoredData(part));
        const storedPart = part as StoredDataCapabilityPart;
        handles.push(storedPart.storedData.handle);
      }
    }
  }

  // Replace again, and confirm we have different blob URLs.
  await store.replaceDataParts("store", result);
  for (const property of Object.values(result.data.outputs)) {
    if (!isLLMContentArray(property)) {
      continue;
    }

    for (const llmEntry of property) {
      for (let i = 0; i < llmEntry.parts.length; i++) {
        const part = llmEntry.parts[i];
        t.truthy(isStoredData(part));
        const storedPart = part as StoredDataCapabilityPart;
        t.notDeepEqual(handles[i], storedPart.storedData.handle);
      }
    }
  }

  store.releaseAll();
});

test("Default Data Store stores blobs against the existing group", async (t) => {
  const store = createDefaultDataStore();
  const blob = new Blob(["Hello, world!"], { type: "text/plain" });

  store.createGroup("store");
  const part = await store.store(blob);
  const retrieved = await store.retrieveAsBlob(part);

  await t.deepEqual(blob, retrieved);
  store.releaseAll();
});

test("Default Data Store stores blobs against other groups", async (t) => {
  const store = createDefaultDataStore();
  const blob = new Blob(["Hello, world!"], { type: "text/plain" });

  store.createGroup("blobs");

  // Creating this group sets the default group in the store, so the test only
  // passes if the blob is found in the right store.
  store.createGroup("store");
  const part = await store.store(blob, "blobs");
  store.releaseGroup("store");

  const retrieved = await store.retrieveAsBlob(part);

  await t.deepEqual(blob, retrieved);
  store.releaseAll();
});

test("Default Data Store releases groups", async (t) => {
  const store = createDefaultDataStore();
  const result = copyResult(inputResult);

  if (!(result.type === "nodeend")) {
    t.fail("Result is not a nodeend");
    return;
  }

  store.createGroup("store");
  await store.replaceDataParts("store", result);

  store.createGroup("store2");
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

  store.createGroup("store");
  await store.replaceDataParts("store", result);

  const serialized = await store.serializeGroup("store");
  t.deepEqual(serialized?.length, 1);
  t.truthy(serialized![0].handle);
  t.deepEqual(serialized![0].inlineData, {
    data: "aabbcc",
    mimeType: "text/plain",
  });

  store.releaseAll();
});
