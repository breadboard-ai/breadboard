/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OutputPortGetter,
  type OutputPortReference,
} from "../internal/common/port.js";

test("monomorphic node with primary output acts like that output port", () => {
  const withPrimaryOut = defineNodeType({
    inputs: {
      in1: {
        type: "string",
      },
    },
    outputs: {
      out1: {
        type: "string",
      },
      out2: {
        type: "number",
        primary: true,
      },
      out3: {
        type: "boolean",
      },
    },
    invoke: () => {
      return {
        out1: "foo",
        out2: 123,
        out3: true,
      };
    },
  });
  const instance = withPrimaryOut({ in1: "foo" });
  instance satisfies OutputPortReference<number>;
  // $ExpectType OutputPort<number>
  instance[OutputPortGetter];

  defineNodeType({
    inputs: { in1: { type: "number" } },
    outputs: {},
    invoke: () => ({}),
  })({
    in1: instance,
  });

  defineNodeType({
    inputs: { in1: { type: "string" } },
    outputs: {},
    invoke: () => ({}),
  })({
    // @ts-expect-error in1 expects string, not number
    in1: instance,
  });
});

test("type error: monomorphic node without primary output doesn't act like an output port", () => {
  const definition = defineNodeType({
    inputs: {},
    outputs: {
      out1: {
        type: "string",
      },
    },
    invoke: () => {
      return {
        out1: "foo",
      };
    },
  });
  const instance = definition({});
  // @ts-expect-error no primary output, not an output
  instance satisfies OutputPortReference<{ type: "string" }>;
  assert.equal(
    // $ExpectType undefined
    instance[OutputPortGetter],
    undefined
  );
});

test("don't allow multiple primary output ports on monomorphic node", () => {
  assert.throws(
    () =>
      defineNodeType({
        inputs: {},
        outputs: {
          foo: {
            type: "string",
            // @ts-expect-error more than one primary
            primary: true,
          },
          bar: {
            type: "string",
            // @ts-expect-error more than one primary
            primary: true,
          },
        },
        invoke: () => ({ foo: "foo", bar: "bar" }),
      }),
    /Node definition has more than one primary output port: foo, bar/
  );
});
