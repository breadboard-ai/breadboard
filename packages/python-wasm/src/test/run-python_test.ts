/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { runPython } from "../run-python.js";

test("can run some python with various types", async () => {
  const result = await runPython.invoke(
    {
      $code: `
{
  "sum": inputs.num + len(inputs.str) + 3,
  "arr": ["foo", 123, True],
  "obj": {"foo": 123}
}`,
      num: 1,
      str: "ab",
    },
    null as never
  );
  assert.deepEqual(result, {
    sum: 6,
    arr: ["foo", 123, true],
    obj: { foo: 123 },
  });
});

test("errors on python exception", async () => {
  const result = await runPython.invoke(
    { $code: `raise Exception("foo")` },
    null as never
  );
  const message = (result?.$error as { error?: { message?: string } }).error
    ?.message;
  assert.match(
    message ?? "",
    /^Error executing Python: PythonError: Traceback/
  );
});

test("errors if string returned instead of dict", async () => {
  const result = await runPython.invoke({ $code: `"foo"` }, null as never);
  assert.deepEqual(result, {
    $error: {
      kind: "error",
      error: {
        message:
          `Python function did not return a dict. ` +
          `Got type "string". Please return a dict with JSON serializable values.`,
      },
    },
  });
});

test("errors if array returned instead of dict", async () => {
  const result = await runPython.invoke({ $code: `["foo"]` }, null as never);
  assert.deepEqual(result, {
    $error: {
      kind: "error",
      error: {
        message:
          `Python function did not return a dict. ` +
          `Got type "array". Please return a dict with JSON serializable values.`,
      },
    },
  });
});

test("default schema", async () => {
  const desc = await runPython.describe({}, null as never);
  assert.deepEqual(desc, {
    inputSchema: {
      type: "object",
      properties: {
        $code: {
          title: "$code",
          description: "The Python code to run",
          format: "multiline",
          type: "string",
        },
      },
      required: ["$code"],
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    },
  });
});
