/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import runJavascript from "../../src/nodes/run-javascript.js";

test("runJavascript runs code", async (t) => {
  const { result } = await runJavascript({
    code: "function run() { return 'hello world'; }",
  });
  t.is(result, "hello world");
});

test("runJavascript correctly strips code", async (t) => {
  {
    const { result } = await runJavascript({
      code: "```js\nfunction run() { return 'hello world'; }\n```",
    });
    t.is(result, "hello world");
  }
  {
    const { result } = await runJavascript({
      code: "```javascript\nfunction run() { return 'hello world'; }\n```",
    });
    t.is(result, "hello world");
  }
});

test("runJavascript runs code with specified function name", async (t) => {
  const { result } = await runJavascript({
    code: "function compute() { return 'hello world'; }",
    name: "compute",
  });
  t.is(result, "hello world");
});

test("runJavascript runs code with arguments", async (t) => {
  const { result } = await runJavascript({
    code: "function run({ what }) { return `hello ${what}`; }",
    what: "world",
  });
  t.is(result, "hello world");
});

test("runJavascript understands `raw` input", async (t) => {
  const result = await runJavascript({
    code: 'function compute() { return { hello: "world" }; }',
    name: "compute",
    raw: true,
  });
  t.deepEqual(result, { hello: "world" });
});
