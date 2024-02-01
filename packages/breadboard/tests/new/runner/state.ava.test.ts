/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { BaseNode } from "../../../src/new/runner/node.js";
import { Scope } from "../../../src/new/runner/scope.js";
import { State } from "../../../src/new/runner/state.js";

test("transfer data across wires", async (t) => {
  const scope = new Scope();
  const node1 = new BaseNode("noop", scope);
  const node2 = new BaseNode("noop", scope);

  node2.addIncomingEdge(node1, "foo", "foo");

  const state = new State();

  t.false(state.missingInputs(node1));
  t.like(state.missingInputs(node2), ["foo"]);

  state.distributeResults(
    { from: node1, to: node2, out: "foo", in: "foo" },
    { foo: "bar" }
  );

  t.false(state.missingInputs(node2));

  const inputs = state.shiftInputs(node2);
  t.deepEqual(inputs, { foo: "bar" });

  t.like(state.missingInputs(node2), ["foo"]);
});

test("build and empty queue", async (t) => {
  const scope = new Scope();
  const node = new BaseNode("noop", scope);

  const state = new State();

  state.distributeResults(
    { from: node, to: node, out: "foo", in: "foo" },
    { foo: "1" }
  );

  state.distributeResults(
    { from: node, to: node, out: "foo", in: "foo" },
    { foo: "2" }
  );

  t.deepEqual(state.shiftInputs(node), { foo: "1" });
  t.deepEqual(state.shiftInputs(node), { foo: "2" });
  t.deepEqual(state.shiftInputs(node), {});
});
