/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from "@esm-bundle/chai";
import { IDBRunStore } from "../../src/run/idb-run-store.js";

import { results as simpleRunResults } from "./simple-run.js";
import { results as inlineDataRunResults } from "./inline-data-run.js";
import {
  isInlineData,
  isLLMContent,
  isStoredData,
} from "@google-labs/breadboard";

it("IDBRunStore stores run events", async () => {
  const store = new IDBRunStore();
  await store.start("store");

  for (const result of simpleRunResults) {
    await store.write(result);
  }

  await store.stop();
  const runs = await store.getNewestRuns();

  expect(runs.length).to.equal(1);
  expect(runs[0].length).to.equal(8);

  await store.drop();
});

it("IDBRunStore replaces inlineData with storedData", async () => {
  const store = new IDBRunStore();
  await store.start("store");

  for (const result of inlineDataRunResults) {
    await store.write(result);
  }

  await store.stop();
  const runs = await store.getNewestRuns();

  expect(runs.length).to.equal(1);
  expect(runs[0].length).to.equal(8);
  expect(runs[0][3].type).to.equal("nodeend");

  const nodeToInspect = runs[0][3];
  if (
    nodeToInspect.type === "nodeend" &&
    nodeToInspect.data.node.type === "input"
  ) {
    const outputs = Object.values(nodeToInspect.data.outputs);
    expect(outputs.length).to.equal(1);
    for (const output of outputs) {
      expect(isLLMContent(output)).to.be.ok;

      if (isLLMContent(output)) {
        for (const part of output.parts) {
          expect(isStoredData(part)).to.be.ok;
        }
      }
    }
  } else {
    expect.fail("Unexpected node type");
  }

  await store.drop();
});

it("IDBRunStore replaces storedData with inlineData when writing", async function () {
  // This test takes a little longer, so give it some time.
  this.timeout(5000);

  // Step 1. Write the data in.
  const store = new IDBRunStore();
  await store.start("store");

  for (const result of inlineDataRunResults) {
    await store.write(result);
  }

  await store.stop();

  // Step 2. Read it back out.
  const initialRun = await store.getNewestRuns();

  await store.start("store2");
  for (const result of initialRun[0]) {
    // Step 3. Assert inlineData is now storedData and write it back in.
    if (result.type === "nodeend" && result.data.node.type === "input") {
      const outputs = Object.values(result.data.outputs);
      expect(outputs.length).to.equal(1);
      for (const output of outputs) {
        expect(isLLMContent(output)).to.be.ok;

        if (isLLMContent(output)) {
          for (const part of output.parts) {
            expect(isStoredData(part)).to.be.ok;
          }
        }
      }
    }

    await store.write(result);
  }

  await store.stop();

  // Step 4. Get the newest run without conversion.
  const run = await store.getNewestRuns(1, false);

  expect(run.length).to.equal(1);
  expect(run[0].length).to.equal(8);
  expect(run[0][3].type).to.equal("nodeend");

  // Step 5. Assert we have an inlineData object.
  const nodeToInspect = run[0][3];
  if (
    nodeToInspect.type === "nodeend" &&
    nodeToInspect.data.node.type === "input"
  ) {
    // console.log(JSON.stringify(nodeToInspect, null, 2));
    const outputs = Object.values(nodeToInspect.data.outputs);
    expect(outputs.length).to.equal(1);
    for (const output of outputs) {
      expect(isLLMContent(output), "Output is not LLM Content").to.be.ok;

      if (isLLMContent(output)) {
        for (const part of output.parts) {
          console.log(part);
          expect(isInlineData(part), "Part is not inlineData").to.be.ok;
        }
      }
    }
  } else {
    expect.fail("Unexpected node type");
  }

  await store.drop();
});
