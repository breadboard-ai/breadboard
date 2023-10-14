/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import handler, {
  RunJavascriptOutputs,
  computeAdditionalInputs,
  computeOutputSchema,
} from "../../src/nodes/run-javascript.js";

test("runJavascript runs code", async (t) => {
  const runJavascript = handler.invoke;
  const { result } = (await runJavascript(
    {
      code: "function run() { return 'hello world'; }",
    },
    {}
  )) as RunJavascriptOutputs;
  t.is(result, "hello world");
});

test("runJavascript correctly strips code", async (t) => {
  const runJavascript = handler.invoke;
  {
    const { result } = (await runJavascript(
      {
        code: "```js\nfunction run() { return 'hello world'; }\n```",
      },
      {}
    )) as RunJavascriptOutputs;
    t.is(result, "hello world");
  }
  {
    const { result } = (await runJavascript(
      {
        code: "```javascript\nfunction run() { return 'hello world'; }\n```",
      },
      {}
    )) as RunJavascriptOutputs;
    t.is(result, "hello world");
  }
});

test("runJavascript runs code with specified function name", async (t) => {
  const runJavascript = handler.invoke;
  const { result } = (await runJavascript(
    {
      code: "function compute() { return 'hello world'; }",
      name: "compute",
    },
    {}
  )) as RunJavascriptOutputs;
  t.is(result, "hello world");
});

test("runJavascript runs code with arguments", async (t) => {
  const runJavascript = handler.invoke;
  const { result } = (await runJavascript(
    {
      code: "function run({ what }) { return `hello ${what}`; }",
      what: "world",
    },
    {}
  )) as RunJavascriptOutputs;
  t.is(result, "hello world");
});

test("runJavascript understands `raw` input", async (t) => {
  const runJavascript = handler.invoke;
  const result = (await runJavascript(
    {
      code: 'function compute() { return { hello: "world" }; }',
      name: "compute",
      raw: true,
    },
    {}
  )) as RunJavascriptOutputs;
  t.deepEqual(result, { hello: "world" });
});

test("`computeOutputSchema` correctly reacts to `raw` input", async (t) => {
  const result = computeOutputSchema({ raw: true });
  t.deepEqual(result, { type: "object", additionalProperties: true });
});

test("`computeAdditionalInputs` correctly reacts to arguments", async (t) => {
  const result = computeAdditionalInputs({
    code: { title: "code" },
    name: { title: "name" },
    raw: { title: "raw" },
    what: { title: "what" },
  });
  t.deepEqual(result, {
    what: { title: "what" },
  });
});
