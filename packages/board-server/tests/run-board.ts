/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { deepStrictEqual, ok } from "assert";
import { runBoard } from "../src/server/boards/utils/run-board.js";
import type { BoardServerLoadFunction } from "../src/server/types.js";
import type { Kit } from "@google-labs/breadboard";

import simpleBoard from "./boards/simple.bgl.json" with { type: "json" };

const mockSecretsKit: Kit = {
  url: import.meta.url,
  handlers: {
    secrets: async (inputs) => {
      throw new Error("Secrets aren't implemented in tests.");
    },
  },
};

describe("Board Server Runs Boards", () => {
  test("can run a simple board", async (t) => {
    const path = "/path/to/board";
    const url = `https://example.com${path}`;
    const inputs = { text: "bar" };
    const loader: BoardServerLoadFunction = async () => simpleBoard;
    const result = await runBoard({
      url,
      path,
      inputs,
      loader,
    });
    deepStrictEqual(result, { text: "bar" });
  });
});
