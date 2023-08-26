/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { DebugProbe } from "../src/debug.js";
import { NodeValue } from "@google-labs/graph-runner";

test("DebugProbe correctly handles input pins that modify inputs", (t) => {
  const probe = new DebugProbe();
  const node = { id: "test" };
  const pin = (v: NodeValue) => (v as number) + 1;
  probe.watchInput(node.id, "test", pin);
  const event = new CustomEvent("beforehandler", {
    detail: {
      descriptor: node,
      inputs: { test: 1 },
    },
  });
  probe.dispatchEvent(event);
  t.deepEqual(event.detail.inputs, { test: 2 });
});

test("DebugProbe correctly handles input pins that return undefined", (t) => {
  const probe = new DebugProbe();
  const node = { id: "test" };
  const pin = (_: NodeValue) => undefined;
  probe.watchInput(node.id, "test", pin);
  const event = new CustomEvent("beforehandler", {
    detail: {
      descriptor: node,
      inputs: { test: 1 },
    },
  });
  probe.dispatchEvent(event);
  t.deepEqual(event.detail.inputs, { test: 1 });
});

test("DebugProbe can replace nodes", (t) => {
  const probe = new DebugProbe();
  const pin = (_: NodeValue) => ({ foo: "bar" });
  const node = { id: "test" };
  probe.replaceNode(node.id, pin);
  const event = new CustomEvent("beforehandler", {
    detail: {
      descriptor: node,
      inputs: {},
      outputs: { test: "test" },
    },
  });
  const dispatchResult = probe.dispatchEvent(event);
  t.true(dispatchResult);
  t.deepEqual(event.detail.outputs, { foo: "bar" });
});
