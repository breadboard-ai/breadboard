/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from "node:test";
import { output } from "../internal/board/output.js";
import { defineNodeType } from "../internal/define/define.js";

/* eslint-disable @typescript-eslint/ban-ts-comment */

test("output usage", () => {
  const strNode = defineNodeType({
    name: "foo",
    inputs: { foo: { type: "string", primary: true } },
    outputs: { foo: { type: "string", primary: true } },
    invoke: () => ({ foo: "foo" }),
  })({ foo: "foo" });

  // $ExpectType Output<string>
  output(strNode);
  // $ExpectType Output<string>
  output(strNode, { id: "foo" });
  // $ExpectType Output<string>
  output(strNode.outputs.foo, { id: "foo" });
  // $ExpectType Output<string>
  output(strNode.outputs.foo, {
    id: "foo",
    title: "My Title",
    description: "My Description",
  });

  const numNode = defineNodeType({
    name: "bar",
    inputs: { bar: { type: "number", primary: true } },
    outputs: { bar: { type: "number", primary: true } },
    invoke: () => ({ bar: 123 }),
  })({ bar: 123 });

  // $ExpectType Output<number>
  output(numNode);
  // $ExpectType Output<number>
  output(numNode, { id: "bar" });
  // $ExpectType Output<number>
  output(numNode.outputs.bar, { id: "bar" });
  // $ExpectType Output<number>
  output(numNode.outputs.bar, {
    id: "bar",
    title: "My Title",
    description: "My Description",
  });

  const multiNode = defineNodeType({
    name: "multi",
    inputs: {
      str: { type: "string" },
      num: { type: "number" },
    },
    outputs: {
      str: { type: "string", primary: true },
      num: { type: "number" },
    },
    invoke: () => ({ str: "foo", num: 123 }),
  })({ str: "foo", num: 123 });

  // $ExpectType Output<string>
  output(multiNode);
  // $ExpectType Output<string>
  output(multiNode, { id: "bar" });
  // $ExpectType Output<string>
  output(multiNode.outputs.str, { id: "bar" });
  // $ExpectType Output<string>
  output(multiNode.outputs.str, {
    id: "bar",
    title: "My Title",
    description: "My Description",
  });
  // $ExpectType Output<number>
  output(multiNode.outputs.num, { id: "bar" });
  // $ExpectType Output<number>
  output(multiNode.outputs.num, {
    id: "bar",
    title: "My Title",
    description: "My Description",
  });

  // @ts-expect-error
  output();

  output(
    // @ts-expect-error
    null,
    { id: "foo" }
  );

  output(strNode, {
    // @ts-expect-error
    id: 123,
  });

  output(strNode, {
    // @ts-expect-error
    title: 123,
  });

  output(strNode, {
    // @ts-expect-error
    description: 123,
  });

  output(strNode, {
    // @ts-expect-error
    unknown: 123,
  });

  output(strNode, {
    // @ts-expect-error
    id: null,
  });

  output(
    // @ts-expect-error
    strNode.outputs,
    { id: "foo" }
  );

  output(
    // @ts-expect-error
    strNode.inputs,
    { id: "foo" }
  );

  output(
    // @ts-expect-error
    strNode.inputs.foo,
    { id: "foo" }
  );
});
