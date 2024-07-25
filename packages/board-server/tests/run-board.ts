/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { deepStrictEqual, ok } from "assert";
import { runBoard } from "../src/server/boards/utils/run-board.js";
import type { GraphDescriptor, Kit } from "@google-labs/breadboard";

import simpleBoard from "./boards/simple.bgl.json" with { type: "json" };
import multipleInputsBoard from "./boards/many-inputs.bgl.json" with { type: "json" };

const mockSecretsKit: Kit = {
  url: import.meta.url,
  handlers: {
    secrets: async (inputs) => {
      throw new Error("Secrets aren't implemented in tests.");
    },
  },
};

describe("Board Server Runs Boards", () => {
  test("can start a simple board", async () => {
    const path = "/path/to/board";
    const result = await runBoard({
      path,
      url: `https://example.com${path}`,
      loader: async () => simpleBoard,
    });
    const state = result.$state;
    ok(state);
  });

  test("can start a simple board with inputs", async () => {
    const path = "/path/to/board";
    const inputs = { text: "bar" };
    const result = await runBoard({
      path,
      url: `https://example.com${path}`,
      inputs,
      loader: async () => simpleBoard,
    });
    const state = result.$state;
    ok(state);
    deepStrictEqual(result.text, "bar");
  });

  test("can start multiple a board with multiple inputs", async () => {
    const path = "/path/to/board";
    const inputs = { text: "bar", number: 42 };
    const result = await runBoard({
      path,
      url: `https://example.com${path}`,
      inputs,
      loader: async () => multipleInputsBoard as GraphDescriptor,
    });
    const state = result.$state;
    ok(state);
  });
});
