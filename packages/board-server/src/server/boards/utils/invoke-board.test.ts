/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { deepStrictEqual } from "assert";
import type { Kit } from "@google-labs/breadboard";

import simpleBoard from "../../../../test-data/boards/simple.bgl.json" with { type: "json" };
import { invokeBoard } from "./invoke-board.js";

const mockSecretsKit: Kit = {
  url: import.meta.url,
  handlers: {
    secrets: async (inputs) => {
      throw new Error("Secrets aren't implemented in tests.");
    },
  },
};

describe("Board Server Invokes Boards", () => {
  test("can invoke a simple board", async () => {
    const path = "/boards/name";
    const inputs = { text: "bar" };
    const result = await invokeBoard({
      serverUrl: "https://example.com",
      path,
      url: `https://example.com${path}`,
      inputs,
      loader: async () => simpleBoard,
    });
    deepStrictEqual(result, { text: "bar" });
  });
});
