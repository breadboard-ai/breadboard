/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { MachineEdgeState } from "../src/traversal/state.js";

test("MachineEdgeState correctly manages queues", (t) => {
  const state = new MachineEdgeState();

  // Initial run.
  state.wireOutputs(
    [
      { from: "a", to: "b", out: "foo", in: "foo" },
      { from: "a", to: "b", out: "bar", in: "baz" },
      { from: "a", to: "c", out: "bar", in: "bar", constant: true },
      { from: "a", to: "d", out: "*" },
    ], // opportunities
    {
      foo: 1,
      bar: 2,
    } // outputs
  );

  // Now let's queue up more data
  state.wireOutputs(
    [{ from: "a", to: "b", out: "foo", in: "foo" }], // opportunities
    {
      foo: 3,
    } // outputs
  );

  // Verify that inputs are were wired correctly.
  t.deepEqual(state.getAvailableInputs("a"), {});
  t.deepEqual(state.getAvailableInputs("b"), { foo: 1, baz: 2 });
  t.deepEqual(state.getAvailableInputs("c"), { bar: 2 });
  t.deepEqual(state.getAvailableInputs("d"), { foo: 1, bar: 2 });

  // Verify that the queues are emptied correctly.
  state.useInputs("b", { foo: 1, baz: 2 });
  t.deepEqual(state.getAvailableInputs("b"), { foo: 3 });

  // Verify that constants remain.
  state.useInputs("c", { bar: 2 });
  t.deepEqual(state.getAvailableInputs("c"), { bar: 2 });

  // Verify that using only inputs leaves the other queues as is.
  state.useInputs("d", { foo: 1 });
  t.deepEqual(state.getAvailableInputs("d"), { bar: 2 });
});
