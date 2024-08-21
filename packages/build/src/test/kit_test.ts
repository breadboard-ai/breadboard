/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from "node:test";
import { kit } from "../internal/kit.js";
import { defineNodeType } from "../internal/define/define.js";
import { board } from "../internal/board/board.js";

const discreteComponent = defineNodeType({
  name: "discreteComponent",
  inputs: {},
  outputs: {},
  invoke: () => ({}),
});

const boardComponent = board({ id: "foo", inputs: {}, outputs: {} });

test("kit takes discrete component", () => {
  // $ExpectType KitConstructor<Kit>
  kit({
    title: "",
    url: "",
    version: "",
    description: "",
    components: { foo: discreteComponent },
  });
});

test("kit takes board component", () => {
  // $ExpectType KitConstructor<Kit>
  kit({
    title: "",
    url: "",
    version: "",
    description: "",
    components: { bar: boardComponent },
  });
});
