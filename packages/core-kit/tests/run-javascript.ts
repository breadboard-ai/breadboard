/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { NodeHandlerContext } from "@google-labs/breadboard";

import handler, { RunJavascriptOutputs } from "../src/nodes/run-javascript.js";

test("runJavascript runs code", async (t) => {
  const runJavascript = handler.invoke;
  const { result } = (await runJavascript(
    {
      code: "function run() { return 'hello world'; }",
    },
    {} as NodeHandlerContext
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
      {} as NodeHandlerContext
    )) as RunJavascriptOutputs;
    t.is(result, "hello world");
  }
  {
    const { result } = (await runJavascript(
      {
        code: "```javascript\nfunction run() { return 'hello world'; }\n```",
      },
      {} as NodeHandlerContext
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
    {} as NodeHandlerContext
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
    {} as NodeHandlerContext
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
    {} as NodeHandlerContext
  )) as RunJavascriptOutputs;
  t.deepEqual(result, { hello: "world" });
});

test("describe outputs when raw = true and schema defined", async (t) => {
  const result = (
    await handler.describe({
      raw: true,
      schema: {
        type: "object",
        properties: {
          hello: { type: "string" },
        },
      },
    })
  ).outputSchema;
  t.deepEqual(result, {
    type: "object",
    properties: {
      hello: {
        type: "string",
        title: "hello",
        description: 'output "hello"',
      },
    },
    required: [],
    additionalProperties: false,
  });
});

test("describe outputs when raw = true", async (t) => {
  const result = (await handler.describe({ raw: true })).outputSchema;
  t.deepEqual(result, {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: true,
  });
});

test("describe outputs when raw = false", async (t) => {
  const result = (await handler.describe({ raw: false })).outputSchema;
  t.deepEqual(result, {
    type: "object",
    properties: {
      result: {
        title: "result",
        description: "The result of running the JavaScript code",
        type: ["array", "boolean", "null", "number", "object", "string"],
      },
    },
    required: [],
    additionalProperties: false,
  });
});

test("describe inputs", async (t) => {
  const result = (
    await handler.describe(
      {},
      {
        type: "object",
        properties: {
          code: { title: "code" },
          name: { title: "name" },
          raw: { title: "raw" },
          what: { title: "what", type: "array", items: { type: "number" } },
        },
      }
    )
  ).inputSchema;
  t.deepEqual(result, {
    type: "object",
    properties: {
      code: {
        behavior: ["config", "code"],
        description: "The JavaScript code to run",
        format: "javascript",
        title: "code",
        type: "string",
      },
      name: {
        default: "run",
        description:
          'The name of the function to invoke in the supplied code. Default value is "run".',
        title: "name",
        type: "string",
      },
      raw: {
        behavior: ["config"],
        default: false,
        description:
          "Whether or not to return use the result of execution as raw output (true) or as a port called `result` (false). Default is false.",
        title: "raw",
        type: "boolean",
      },
      schema: {
        additionalProperties: true,
        behavior: ["config", "ports-spec"],
        description:
          "The schema of the output data. This is used to validate the output data before running the code.",
        properties: {},
        required: [],
        title: "schema",
        type: "object",
      },
      what: {
        title: "what",
        type: "array",
        items: { type: "number" },
      },
    },
    required: ["code"],
    additionalProperties: true,
  });
});

test("real function computes as expected", async (t) => {
  const code = function run(args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke(
    {
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("real function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = function run(args: unknown) {
    return args;
  }.toString();

  const result = await handler.invoke(
    {
      input,
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, { input });
});

test("arrow function computes as expected", async (t) => {
  const code = ((args: unknown) => {
    return { args };
  }).toString();

  const result = await handler.invoke(
    {
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("arrow function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = ((args: unknown) => {
    return args;
  }).toString();

  const result = await handler.invoke(
    {
      input,
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, { input });
});

test("anonymous function computes as expected", async (t) => {
  const code = function (args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke(
    {
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("anonymous function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = function (args: unknown) {
    return args;
  }.toString();

  const result = await handler.invoke(
    {
      input,
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, { input });
});

test("named function computes as expected", async (t) => {
  const code = function run(args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke(
    {
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected with input", async (t) => {
  const input = "Hello World";

  const code = function run(args: unknown) {
    return args;
  }.toString();

  const result = await handler.invoke(
    {
      input,
      code,
      raw: true,
    },
    {}
  );

  t.deepEqual(result, { input });
});

test("anonymous function computes as expected when a name is provided", async (t) => {
  const code = function (args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke(
    {
      code,
      name: "test",
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("arrow function computes as expected when a name is provided", async (t) => {
  const code = ((args: unknown) => {
    return { args };
  }).toString();

  const result = await handler.invoke(
    {
      code,
      name: "test",
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected when a name is provided", async (t) => {
  const code = function run(args: unknown) {
    return { args };
  }.toString();

  const result = await handler.invoke(
    {
      code,
      name: "test",
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected when a name is provided and the function is anonymous", async (t) => {
  function fn(args: unknown) {
    return { args };
  }

  const result = await handler.invoke(
    {
      code: fn.toString(),
      name: "test",
      raw: true,
    },
    {}
  );

  t.deepEqual(result, {
    args: {},
  });
});

test("named function computes as expected when a name is provided and the function is an arrow function", async (t) => {
  const input = "Hello World";
  const fn = (args: unknown) => {
    return { args };
  };

  const result = await handler.invoke(
    {
      input,
      code: fn.toString(),
      name: "test",
      raw: true,
    },
    {}
  );

  t.deepEqual(result, { args: { input } });
});
