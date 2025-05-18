/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import handler, { RunJavascriptOutputs } from "../src/nodes/run-javascript.js";

test("runJavascript runs code", async (t) => {
  const runJavascript = handler.invoke;
  const { result } = (await runJavascript({
    code: "function run() { return 'hello world'; }",
  })) as RunJavascriptOutputs;
  t.is(result, "hello world");
});

test("runJavascript correctly strips code", async (t) => {
  const runJavascript = handler.invoke;
  {
    const { result } = (await runJavascript({
      code: "```js\nfunction run() { return 'hello world'; }\n```",
    })) as RunJavascriptOutputs;
    t.is(result, "hello world");
  }
  {
    const { result } = (await runJavascript({
      code: "```javascript\nfunction run() { return 'hello world'; }\n```",
    })) as RunJavascriptOutputs;
    t.is(result, "hello world");
  }
});

test("runJavascript runs code with specified function name", async (t) => {
  const runJavascript = handler.invoke;
  const { result } = (await runJavascript({
    code: "function compute() { return 'hello world'; }",
    name: "compute",
  })) as RunJavascriptOutputs;
  t.is(result, "hello world");
});

test("runJavascript runs code with arguments", async (t) => {
  const runJavascript = handler.invoke;
  const { result } = (await runJavascript({
    code: "function run({ what }) { return `hello ${what}`; }",
    what: "world",
  })) as RunJavascriptOutputs;
  t.is(result, "hello world");
});

test("runJavascript understands `raw` input", async (t) => {
  const runJavascript = handler.invoke;
  const result = (await runJavascript({
    code: 'function compute() { return { hello: "world" }; }',
    name: "compute",
    raw: true,
  })) as RunJavascriptOutputs;
  t.deepEqual(result, { hello: "world" });
});

test("real function computes as expected", async (t) => {
  const code = function run(args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke({
    code,
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("real function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = function run(args: unknown) {
    return args;
  }.toString();

  const result = await handler.invoke({
    input,
    code,
    raw: true,
  });

  t.deepEqual(result, { input });
});

test("arrow function computes as expected", async (t) => {
  const code = ((args: unknown) => {
    return { args };
  }).toString();

  const result = await handler.invoke({
    code,
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("arrow function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = ((args: unknown) => {
    return args;
  }).toString();

  const result = await handler.invoke({
    input,
    code,
    raw: true,
  });

  t.deepEqual(result, { input });
});

test("anonymous function computes as expected", async (t) => {
  const code = function (args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke({
    code,
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("anonymous function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = function (args: unknown) {
    return args;
  }.toString();

  const result = await handler.invoke({
    input,
    code,
    raw: true,
  });

  t.deepEqual(result, { input });
});

test("named function computes as expected", async (t) => {
  const code = function run(args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke({
    code,
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = function run(args: unknown) {
    return args;
  }.toString();

  const result = await handler.invoke({
    input,
    code,
    raw: true,
  });

  t.deepEqual(result, { input });
});

test("anonymous function computes as expected when a name is provided", async (t) => {
  const code = function (args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke({
    code,
    name: "test",
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("arrow function computes as expected when a name is provided", async (t) => {
  const code = ((args: unknown) => {
    return { args };
  }).toString();

  const result = await handler.invoke({
    code,
    name: "test",
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected when a name is provided", async (t) => {
  const code = function run(args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke({
    code,
    name: "test",
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected when a name is provided and the function is anonymous", async (t) => {
  function fn(args: unknown) {
    return { args };
  }

  const result = await handler.invoke({
    code: fn.toString(),
    name: "test",
    raw: true,
  });

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected when a name is provided and the function is an arrow function", async (t) => {
  const input = "Hello World";
  const fn = (args: unknown) => {
    return { args };
  };

  const result = await handler.invoke({
    input,
    code: fn.toString(),
    name: "test",
    raw: true,
  });

  t.deepEqual(result, { args: { input } });
});
