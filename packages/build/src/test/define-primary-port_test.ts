/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OutputPortGetter, type OutputPortReference } from "../port.js";

test("node with primary output acts like that output port", () => {
  const withPrimaryOut = defineNodeType(
    {
      in1: {
        type: "string",
      },
    },
    {
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
    () => {
      return {
        out1: "foo",
        out2: 123,
        out3: true,
      };
    }
  );
  const instance = withPrimaryOut({ in1: "foo" });
  instance satisfies OutputPortReference<{ type: "number" }>;
  // $ExpectType OutputPort<{ type: "number"; }>
  instance[OutputPortGetter];

  defineNodeType({ in1: { type: "number" } }, {}, () => ({}))({
    in1: instance,
  });

  defineNodeType({ in1: { type: "string" } }, {}, () => ({}))({
    // @ts-expect-error in1 expects string, not number
    in1: instance,
  });
});

test("type error: node without primary output doesn't act like an output port", () => {
  const definition = defineNodeType(
    {},
    {
      out1: {
        type: "string",
      },
    },
    () => {
      return {
        out1: "foo",
      };
    }
  );
  const instance = definition({ in1: "foo" });
  // @ts-expect-error no primary output, not an output
  instance satisfies OutputPortReference<{ type: "string" }>;
  assert.equal(
    // $ExpectType undefined
    instance[OutputPortGetter],
    undefined
  );
});

test("don't allow multiple primary output ports", () => {
  assert.throws(
    () =>
      defineNodeType(
        {},
        {
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
        () => ({ foo: "foo", bar: "bar" })
      ),
    /Node definition has more than one primary output port: foo, bar/
  );
});
