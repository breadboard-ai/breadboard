/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { testEditGraph } from "./graph.js";

test("Multi-edit returns a last failed edit's error message", async (t) => {
  const graph = testEditGraph();
  const result = await graph.edit(
    [
      {
        type: "addnode",
        node: {
          id: "node0",
          type: "foo",
        },
      },
    ],
    true
  );

  if (result.success) {
    t.fail();
    return;
  }
  t.true(result.log.length === 1);
  const singleEdit = result.log[0].result;
  if (singleEdit.success) {
    t.fail();
    return;
  }
  t.assert(result.error === singleEdit.error);
});
