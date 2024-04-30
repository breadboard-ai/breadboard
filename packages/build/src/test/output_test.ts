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
  const foo = defineNodeType({
    name: "foo",
    inputs: { foo: { type: "string", primary: true } },
    outputs: { foo: { type: "string", primary: true } },
    invoke: () => ({ foo: "foo" }),
  })({ foo: "foo" });

  output(foo);
  output(foo, { id: "foo" });
  output(foo.outputs.foo, { id: "foo" });
  output(foo.outputs.foo, {
    id: "foo",
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

  output(foo, {
    // @ts-expect-error
    id: 123,
  });

  output(foo, {
    // @ts-expect-error
    title: 123,
  });

  output(foo, {
    // @ts-expect-error
    description: 123,
  });

  output(foo, {
    // @ts-expect-error
    unknown: 123,
  });

  output(foo, {
    // @ts-expect-error
    id: null,
  });

  output(
    // @ts-expect-error
    foo.outputs,
    { id: "foo" }
  );

  output(
    // @ts-expect-error
    foo.inputs,
    { id: "foo" }
  );

  output(
    // @ts-expect-error
    foo.inputs.foo,
    { id: "foo" }
  );
});
