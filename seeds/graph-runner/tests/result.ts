/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { MachineResult } from "../src/traversal/result.js";
import { TraversalState } from "../src/traversal/state.js";

test("MachineResult#skip", (t) => {
  {
    const result = new MachineResult(
      { id: "test", type: "test" },
      {},
      ["input"],
      [],
      [],
      new TraversalState()
    );
    t.true(result.skip);
  }
  {
    const result = new MachineResult(
      { id: "test", type: "test" },
      {},
      [],
      [],
      [],
      new TraversalState()
    );
    t.false(result.skip);
  }
});

test("MachineResult#toJSON", (t) => {
  const result = new MachineResult(
    { id: "test", type: "test" },
    {},
    ["input"],
    [],
    [],
    new TraversalState()
  );
  t.is(
    JSON.stringify(result),
    '{"descriptor":{"id":"test","type":"test"},"inputs":{},"missingInputs":["input"],"opportunities":[],"state":"{\\"state\\":{\\"$type\\":\\"Map\\",\\"value\\":[]},\\"constants\\":{\\"$type\\":\\"Map\\",\\"value\\":[]}}"}'
  );
});

test("MachineResult JSON roundtrip", (t) => {
  const result = new MachineResult(
    { id: "test", type: "test" },
    {},
    ["input"],
    [],
    [],
    new TraversalState()
  );
  t.deepEqual(MachineResult.fromJSON(JSON.stringify(result)), result);
});
