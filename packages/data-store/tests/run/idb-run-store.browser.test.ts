/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from "@esm-bundle/chai";
import { IDBRunStore } from "../../src/run/idb-run-store.js";

import { HarnessRunResult } from "@breadboard-ai/types";
import {
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  toStoredDataPart,
} from "@google-labs/breadboard";
import { results as inlineDataArrayRunResults } from "./inline-data-run-array.js";
import { results as inlineDataRunResults } from "./inline-data-run.js";
import { results as simpleRunResults } from "./simple-run.js";

const url = "http://www.example.com";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

before(async () => {
  const store = new IDBRunStore();
  await store.drop();
});

it("IDBRunStore stores run events", async () => {
  const runStore = new IDBRunStore();
  const url = "http://www.example.com";
  const timestamp = await runStore.start(url);

  for (const result of simpleRunResults) {
    await runStore.write(url, timestamp, result);
  }

  await runStore.stop(url, timestamp);
  const runs = await runStore.getStoredRuns(url);

  expect(runs.size).to.equal(1);
  expect([...runs.values()][0].length).to.equal(8);

  await runStore.drop();
});

it("IDBRunStore creates multiple stores per URL", async () => {
  const runStore = new IDBRunStore();

  const runTimestamp = await runStore.start(url);
  await runStore.stop(url, runTimestamp);

  // Wait 10ms so that the timestamps of the two runs don't clash.
  await delay(10);

  const runTimestamp2 = await runStore.start(url);
  await runStore.stop(url, runTimestamp2);

  const runs = await runStore.getStoredRuns(url);
  expect(runs.size).to.equal(2);

  await runStore.drop();
});

it("IDBRunStore writes data", async () => {
  const runStore = new IDBRunStore();
  const result = copyResult(inputResult);
  const runTimestamp = await runStore.start(url);
  await runStore.write(url, runTimestamp, result);
  await runStore.stop(url, runTimestamp);
  const runs = await runStore.getStoredRuns(url);

  expect(runs.size).to.equal(1);
  expect(runs.get(runTimestamp)![0].type).to.deep.equal(result.type);
  expect(runs.get(runTimestamp)![0].data).to.deep.equal(result.data);
  await runStore.drop();
});

it("IDBRunStore drops data", async () => {
  const runStore = new IDBRunStore();
  const result = copyResult(inputResult);
  const runTimestamp = await runStore.start(url);
  await runStore.write(url, runTimestamp, result);
  await runStore.stop(url, runTimestamp);
  await runStore.drop();
  const runs = await runStore.getStoredRuns(url);
  expect(runs.size).to.equal(0);
});

it("IDBRunStore truncates data", async () => {
  const runStore = new IDBRunStore();
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
  expect(runs.size).to.equal(1);
  expect(runs.get(runTimestamp2)).to.be.ok;

  await runStore.drop();
});

it("IDBRunStore replaces storedData with inlineData when writing (LLM Content)", async () => {
  // Step 1. Write the data in, converting inlineData parts to storedDataParts
  // before they get written in.
  const runStore = new IDBRunStore();
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

  expect(run.size).to.equal(1);
  expect(runValues[0].length).to.equal(8);
  expect(runValues[0][3].type).to.equal("nodeend");

  // Step 3. Assert we have an inlineData object.
  const nodeToInspect = runValues[0][3];
  if (
    nodeToInspect.type === "nodeend" &&
    nodeToInspect.data.node.type === "input"
  ) {
    const outputs = Object.values(nodeToInspect.data.outputs);
    expect(outputs.length).to.equal(1);
    for (const output of outputs) {
      expect(isLLMContent(output), "Output is not LLM Content").to.be.ok;

      if (isLLMContent(output)) {
        for (const part of output.parts) {
          expect(isInlineData(part), "Part is not inlineData").to.be.ok;
        }
      }
    }
  } else {
    expect.fail("Unexpected node type");
  }

  await runStore.drop();
});

it("IDBRunStore replaces storedData with inlineData when writing (LLM Content Array)", async () => {
  // Step 1. Write the data in, converting inlineData parts to storedDataParts
  // before they get written in.
  const runStore = new IDBRunStore();
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

  expect(run.size).to.equal(1);
  expect(runValues[0].length).to.equal(9);
  expect(runValues[0][3].type).to.equal("nodeend");

  // Step 3. Assert we have an inlineData object.
  const nodeToInspect = runValues[0][3];
  if (
    nodeToInspect.type === "nodeend" &&
    nodeToInspect.data.node.type === "input"
  ) {
    const outputs = Object.values(nodeToInspect.data.outputs);
    expect(outputs.length).to.equal(1);
    for (const output of outputs) {
      expect(isLLMContentArray(output), "Output is not LLM Content Array").to.be
        .ok;

      if (isLLMContentArray(output)) {
        for (const entry of output) {
          for (const part of entry.parts) {
            expect(isInlineData(part), "Part is not inlineData").to.be.ok;
          }
        }
      }
    }
  } else {
    expect.fail("Unexpected node type");
  }

  await runStore.drop();
});
