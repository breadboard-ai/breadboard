/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonSchema } from "../../internal/type-system/json-schema.js";
import { toJSONSchema } from "../../internal/type-system/type.js";

test("type and serialization", () => {
  assert.deepEqual(
    toJSONSchema(
      // $ExpectType AdvancedBreadboardType<Schema>
      jsonSchema
    ),
    {
      type: "object",
      behavior: ["json-schema"],
      properties: {},
      required: [],
      additionalProperties: true,
    }
  );
});
