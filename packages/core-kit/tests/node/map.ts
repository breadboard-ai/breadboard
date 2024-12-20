/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import test, { describe } from "node:test";

import Core from "../../src/index.js";
import {
  ErrorObject,
  InputValues,
  OutputValues,
  asRuntimeKit,
  createGraphStore,
  createLoader,
} from "@google-labs/breadboard";
import { RunConfig, run } from "@google-labs/breadboard/harness";

type SimpleRunResult = {
  output: OutputValues | null;
  error: string | ErrorObject | null;
};

const runBoard = async (
  board: string,
  inputs: InputValues
): Promise<SimpleRunResult> => {
  const loader = createLoader();
  const kits = [asRuntimeKit(Core)];
  const config: RunConfig = {
    base: new URL(import.meta.url),
    kits,
    url: `../../../tests/data/boards/${board}`,
    graphStore: createGraphStore({
      kits,
      sandbox: {
        runModule() {
          throw new Error("Do not use sandbox with test graph store");
        },
      },
      loader,
    }),
  };
  for await (const result of run(config)) {
    const { type } = result;
    switch (type) {
      case "input": {
        result.reply({ inputs });
        break;
      }
      case "output": {
        return { error: null, output: result.data.outputs };
      }
      case "error": {
        return { error: result.data.error, output: null };
      }
    }
  }
  return { error: null, output: null };
};

describe("map", () => {
  test("correctly reports errors in invoked boards", async () => {
    const result = await runBoard("map-throw-error.bgl.json", {});
    assert.ok(result.error !== null);
  });
});
