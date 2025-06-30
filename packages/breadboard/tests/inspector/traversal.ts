/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// These test traversal of the inspector API.

import test from "ava";

import { createLoader } from "@breadboard-ai/loader";
import { inspector } from "../helpers/_inspector.js";

const BASE_URL = new URL("../../../tests/inspector/data/", import.meta.url);

const load = async (url: string) => {
  const base = BASE_URL;
  const loader = createLoader();
  const result = await loader.load(url, { base });
  if (!result.success) return undefined;
  return inspector(result.graph);
};

test("inspector API can traverse simplest.json", async (t) => {
  const simplest = await load("simplest.json");
  // This is mostly to avoid needing to do `graph?` everywhere.
  if (!simplest) {
    return t.fail("Graph is undefined");
  }
  t.assert(simplest.nodes().length == 3, "The graph has three nodes");

  const entries = simplest.entries();
  t.assert(entries.length == 1, "The graph has one entry");

  const input = entries[0];
  t.assert(input.descriptor.type == "input", "The entry is an input");

  const fromInput = input.outgoing();
  t.assert(fromInput.length == 1, "The input has one outgoing edge");

  const invoke = fromInput[0].to;
  t.assert(invoke.descriptor.type == "invoke", "The next node is an invoke");

  const fromInvoke = invoke.outgoing();
  t.assert(fromInvoke.length == 1, "The invoke has one outgoing edge");

  const output = fromInvoke[0].to;
  t.assert(output.descriptor.type == "output", "The next node is an output");
  t.assert(output.isExit(), "The output is an exit node");
});
