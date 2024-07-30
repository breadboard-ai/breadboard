/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";

import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import { interruptibleScriptedRun } from "../scripted-run.js";

describe("interruptibleRunGraph end-to-end", async () => {
  test("simple graph", async () => {
    await interruptibleScriptedRun(simple, [
      { expected: { type: "input" }, inputs: { text: "Hello" } },
      { expected: { type: "output", outputs: [{ text: "Hello" }] } },
    ]);
  });
});
