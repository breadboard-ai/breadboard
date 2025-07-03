/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  toStoredDataPart,
} from "@breadboard-ai/utils";
import type { HarnessRunResult } from "@breadboard-ai/types";
import { results as inlineDataRunResults } from "../node/inline-data-run.js";
import { results as inlineDataArrayRunResults } from "../node/inline-data-run-array.js";
import { createDefaultRunStore } from "@breadboard-ai/data";

const url = "http://www.example.com";

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

function copyResult(result: HarnessRunResult): HarnessRunResult {
  // We can't use structuredClone because of the async function, so we fall back
  // to using parse/stringify to make a copy.
  return JSON.parse(JSON.stringify(result));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("Default Run Store creates multiple stores per URL", async (t) => {
  const runStore = createDefaultRunStore();

  const runTimestamp = await runStore.start(url);
  await runStore.stop(url, runTimestamp);

  // Wait 10ms so that the timestamps of the two runs don't clash.
  await delay(10);

  const runTimestamp2 = await runStore.start(url);
  await runStore.stop(url, runTimestamp2);

  const runs = await runStore.getStoredRuns(url);
  t.is(runs.size, 2);

  await runStore.drop();
});

test("Default Run Store writes data", async (t) => {
  const runStore = createDefaultRunStore();
  const result = copyResult(inputResult);
  const runTimestamp = await runStore.start(url);
  await runStore.write(url, runTimestamp, result);
  await runStore.stop(url, runTimestamp);
  const runs = await runStore.getStoredRuns(url);

  t.is(runs.size, 1);
  t.deepEqual(runs.get(runTimestamp)![0], result);
  await runStore.drop();
});

test("Default Run Store drops data", async (t) => {
  const runStore = createDefaultRunStore();
  const result = copyResult(inputResult);
  const runTimestamp = await runStore.start(url);
  await runStore.write(url, runTimestamp, result);
  await runStore.stop(url, runTimestamp);
  await runStore.drop();
  const runs = await runStore.getStoredRuns(url);
  t.is(runs.size, 0);
});

test("Default Run Store truncates data", async (t) => {
  const runStore = createDefaultRunStore();
  const result = copyResult(inputResult);

  const runTimestamp = await runStore.start(url);
  await runStore.write(url, runTimestamp, result);
  await runStore.stop(url, runTimestamp);

  // Wait 10ms so that the timestamps of the two runs don't clash.
  await delay(10);

  const runTimestamp2 = await runStore.start(url);
  await runStore.write(url, runTimestamp2, result);
  await runStore.stop(url, runTimestamp2);

  await runStore.truncate(url, 1);
  const runs = await runStore.getStoredRuns(url);
  t.is(runs.size, 1);
  t.truthy(runs.get(runTimestamp2));
});

test.skip("IDBRunStore replaces storedData with inlineData when writing (LLM Content)", async (t) => {
  // Step 1. Write the data in, converting inlineData parts to storedDataParts
  // before they get written in.
  const runStore = createDefaultRunStore();
  const timestamp = await runStore.start(url);

  for (const result of inlineDataRunResults) {
    if (result.type === "nodeend" && result.data.node.type === "input") {
      for (const output of Object.values(result.data.outputs)) {
        if (!isLLMContent(output)) {
          continue;
        }

        for (let i = 0; i < output.parts.length; i++) {
          const part = output.parts[i];
          if (!isInlineData(part)) {
            continue;
          }

          output.parts[i] = await toStoredDataPart(part);
        }
      }
    }

    await runStore.write(url, timestamp, result);
  }

  await runStore.stop(url, timestamp);

  // Step 2. Get the run.
  const run = await runStore.getStoredRuns(url);
  const runValues = [...run.values()];

  t.is(run.size, 1);
  t.is(runValues[0].length, 8);
  t.is(runValues[0][3].type, "nodeend");

  // Step 3. Assert we have an inlineData object.
  const nodeToInspect = runValues[0][3];
  if (
    nodeToInspect.type === "nodeend" &&
    nodeToInspect.data.node.type === "input"
  ) {
    const outputs = Object.values(nodeToInspect.data.outputs);
    t.is(outputs.length, 1);
    for (const output of outputs) {
      t.truthy(isLLMContent(output), "Output is not LLM Content");

      if (isLLMContent(output)) {
        for (const part of output.parts) {
          t.truthy(isInlineData(part), "Part is not inlineData");
        }
      }
    }
  } else {
    t.fail("Unexpected node type");
  }

  await runStore.drop();
});

test.skip("IDBRunStore replaces storedData with inlineData when writing (LLM Content Array)", async (t) => {
  // Step 1. Write the data in, converting inlineData parts to storedDataParts
  // before they get written in.
  const runStore = createDefaultRunStore();
  const timestamp = await runStore.start(url);

  for (const result of inlineDataArrayRunResults) {
    if (result.type === "nodeend" && result.data.node.type === "input") {
      for (const output of Object.values(result.data.outputs)) {
        if (!isLLMContentArray(output)) {
          continue;
        }

        for (const entry of output) {
          for (let i = 0; i < entry.parts.length; i++) {
            const part = entry.parts[i];
            if (!isInlineData(part)) {
              continue;
            }

            entry.parts[i] = await toStoredDataPart(part);
          }
        }
      }
    }

    await runStore.write(url, timestamp, result);
  }

  await runStore.stop(url, timestamp);

  // Step 2. Get the run.
  const run = await runStore.getStoredRuns(url);
  const runValues = [...run.values()];

  t.is(run.size, 1);
  t.is(runValues[0].length, 9);
  t.is(runValues[0][3].type, "nodeend");

  // Step 3. Assert we have an inlineData object.
  const nodeToInspect = runValues[0][3];
  if (
    nodeToInspect.type === "nodeend" &&
    nodeToInspect.data.node.type === "input"
  ) {
    const outputs = Object.values(nodeToInspect.data.outputs);
    t.is(outputs.length, 1);
    for (const output of outputs) {
      t.truthy(isLLMContentArray(output), "Output is not LLM Content Array");

      if (isLLMContentArray(output)) {
        for (const entry of output) {
          for (const part of entry.parts) {
            t.truthy(isInlineData(part), "Part is not inlineData");
          }
        }
      }
    }
  } else {
    t.fail("Unexpected node type");
  }

  await runStore.drop();
});
