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
  toStoredDataPart,
} from "@google-labs/breadboard";

before(async () => {
  const store = new IDBRunStore();
  await store.drop();
});

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

it("IDBRunStore replaces storedData with inlineData when writing", async () => {
  // Step 1. Write the data in, converting inlineData parts to storedDataParts
  // before they get written in.
  const store = new IDBRunStore();
  await store.start("store");

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

    await store.write(result);
  }

  await store.stop();

  // Step 2. Get the run.
  const run = await store.getNewestRuns();

  expect(run.length).to.equal(1);
  expect(run[0].length).to.equal(8);
  expect(run[0][3].type).to.equal("nodeend");

  // Step 3. Assert we have an inlineData object.
  const nodeToInspect = run[0][3];
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

  await store.drop();
});
