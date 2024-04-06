/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { editBlank } from "../../src/index.js";

test("importBlank creates a nice blank board", async (t) => {
  const blank = await editBlank();
  t.truthy(blank);

  const inspectable = blank.inspect();

  const input = inspectable.nodeById("input");
  t.truthy(input);

  const outgoing = input?.outgoing();
  t.is(outgoing?.length, 1);

  const wire = outgoing?.[0];
  const output = wire?.to;
  t.truthy(output);

  t.is(output?.title(), "output");
});
