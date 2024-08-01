/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, array, object } from "@breadboard-ai/build";
import assert from "node:assert/strict";
import { test } from "node:test";
import { toJSONSchema } from "../../internal/type-system/type.js";

test("can annotate a nested object with a behavior", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<{ foo: number; }[]>
      array(
        annotate(object({ foo: "number" }), {
          behavior: ["llm-content"],
        })
      )
    ),
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          foo: { type: "number" },
        },
        required: ["foo"],
        additionalProperties: false,
        behavior: ["llm-content"],
      },
    }
  );
});

test("can annotate basic type with behavior", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType "string"
      annotate("string", {
        behavior: ["llm-content"],
      })
    ),
    {
      type: "string",
      behavior: ["llm-content"],
    }
  );
});
