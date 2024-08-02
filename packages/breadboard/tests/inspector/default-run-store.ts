/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { createDefaultRunStore } from "../../src/index.js";
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

test("Default Run Store throws if already writing", async (t) => {
  const runStore = createDefaultRunStore();

  await runStore.start("store");
  await t.throwsAsync(runStore.start("store"));
});

test("Default Run Store removes old stores", async (t) => {
  const runStore = createDefaultRunStore();

  await runStore.start("store", 1);
  await runStore.stop();

  await runStore.start("store2", 1);
  await runStore.stop();

  const runs = await runStore.getNewestRuns(3);
  t.is(runs.length, 1);
});

test("Default Run Store writes data", async (t) => {
  const runStore = createDefaultRunStore();
  const result = copyResult(inputResult);

  await runStore.start("store", 1);
  await runStore.write(result);
  await runStore.stop();

  const runs = await runStore.getNewestRuns(1);
  t.is(runs.length, 1);
  t.deepEqual(runs[0][0], result);
});

test("Default Run Store drops data", async (t) => {
  const runStore = createDefaultRunStore();
  const result = copyResult(inputResult);

  await runStore.start("store", 1);
  await runStore.write(result);
  await runStore.stop();

  await runStore.drop();

  const runs = await runStore.getNewestRuns(1);
  t.is(runs.length, 0);
});
