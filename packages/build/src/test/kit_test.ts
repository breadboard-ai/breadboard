/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { board } from "../internal/board/board.js";
import { defineNodeType } from "../internal/define/define.js";
import { kit } from "../internal/kit.js";

const discreteComponent = defineNodeType({
  name: "discreteComponent",
  inputs: {},
  outputs: {},
  invoke: () => ({}),
});

const boardComponent = board({
  id: "boardComponent",
  inputs: {},
  outputs: {},
});

test("kit takes discrete component", () => {
  // $ExpectType KitConstructor<Kit> & { foo: Definition<{}, {}, undefined, undefined, never, false, false, false, {}>; }
  const k = kit({
    title: "",
    url: "",
    version: "",
    description: "",
    components: { foo: discreteComponent },
  });
  assert.ok(
    // $ExpectType Definition<{}, {}, undefined, undefined, never, false, false, false, {}>
    k.foo
  );
  assert.equal(k.foo.id, "foo");
});

test("kit takes board component", () => {
  // $ExpectType KitConstructor<Kit> & { bar: BoardDefinition<{}, {}>; }
  const k = kit({
    title: "",
    url: "",
    version: "",
    description: "",
    components: { bar: boardComponent },
  });
  assert.ok(
    // $ExpectType BoardDefinition<{}, {}>
    k.bar
  );
  assert.equal(k.bar.id, "bar");
});
