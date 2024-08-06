/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { createDefaultRunStore } from "../../src/index.js";
import { HarnessRunResult } from "../../src/harness/types.js";

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
