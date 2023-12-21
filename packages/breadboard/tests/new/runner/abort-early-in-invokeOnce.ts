/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { InputValues } from "../../../src/new/runner/types.js";
import { Scope } from "../../../src/new/runner/scope.js";
import { BaseNode } from "../../../src/new/runner/node.js";

test("abort once the first output is called", async (t) => {
  const scope = new Scope();

  const input = new BaseNode("input", scope);
  const noop = new BaseNode("noop", scope);
  const output = new BaseNode("output", scope);
  const noop2 = new BaseNode("noop", scope);
  noop.addIncomingEdge(input, "foo", "foo");
  output.addIncomingEdge(noop, "foo", "bar");
  noop2.addIncomingEdge(output, "", "");

  scope.pin(output);

  let noopCalls = 0;

  const handlers = {
    noop: (inputs: InputValues) => {
      noopCalls++;
      return { ...inputs };
    },
  };

  scope.addHandlers(handlers);

  const result = await scope.invokeOnce({ foo: "success" });

  t.deepEqual(result, { bar: "success" });
  t.is(noopCalls, 1);
});
