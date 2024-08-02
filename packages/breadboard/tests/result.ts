/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { MachineResult } from "../src/traversal/result.js";
import { MachineEdgeState } from "../src/traversal/state.js";

test("MachineResult#skip", (t) => {
  {
    const result = new MachineResult(
      { id: "test", type: "test" },
      {},
      ["input"],
      [],
      [],
      new MachineEdgeState()
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
      new MachineEdgeState()
    );
    t.false(result.skip);
  }
});
