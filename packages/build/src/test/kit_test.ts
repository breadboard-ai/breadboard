/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { board } from "../internal/board/board.js";
import { input } from "../internal/board/input.js";
import { defineNodeType } from "../internal/define/define.js";
import { kit } from "../internal/kit.js";

const discreteComponent = defineNodeType({
  name: "discreteComponent",
  inputs: {
    str: {
      type: "string",
    },
  },
  outputs: {
    str: {
      type: "string",
    },
  },
  invoke: ({ str }) => ({ str }),
});

const num = input({ type: "number" });
const boardComponent = board({
  id: "boardComponent",
  inputs: { num },
  outputs: { num },
});

test("kit takes discrete component", () => {
  // $ExpectType KitConstructor<Kit> & { foo: Definition<{ str: string; }, { str: string; }, undefined, undefined, never, false, false, false, { str: { board: false; }; }>; }
  const k = kit({
    title: "",
    url: "",
    version: "",
    description: "",
    components: { foo: discreteComponent },
  });
  assert.ok(
    // $ExpectType Definition<{ str: string; }, { str: string; }, undefined, undefined, never, false, false, false, { str: { board: false; }; }>
    k.foo
  );
  assert.equal(k.foo.id, "foo");
});

test("kit takes board component", () => {
  // $ExpectType KitConstructor<Kit> & { bar: BoardDefinition<{ num: number; }, { num: number; }>; }
  const k = kit({
    title: "",
    url: "",
    version: "",
    description: "",
    components: { bar: boardComponent },
  });
  assert.ok(
    // $ExpectType BoardDefinition<{ num: number; }, { num: number; }>
    k.bar
  );
  assert.equal(k.bar.id, "bar");
});
