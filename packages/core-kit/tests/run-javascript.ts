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

test("raw=true with provided schemas", async (t) => {
  const result = await handler.describe({
    raw: true,
    inputSchema: {
      type: "object",
      properties: { foo: { type: "string" } },
    },
    outputSchema: {
      type: "object",
      properties: { bar: { type: "number" } },
    },
  });
  t.deepEqual(result, {
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          title: "Code",
          description: "The JavaScript code to run",
          format: "javascript",
          behavior: ["config", "hint-code"],
        },
        foo: {
          type: "string",
        },
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Input Schema",
          description: "The schema of the input data, the function arguments.",
          behavior: ["config", "ports-spec"],
        },
        name: {
          type: "string",
          title: "Function Name",
          description:
            'The name of the function to invoke in the supplied code. Default value is "run".',
          default: "run",
          behavior: ["config"],
        },
        outputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Output Schema",
          description:
            "The schema of the output data, the shape of the object of the function return value.",
          behavior: ["config", "ports-spec"],
        },
        raw: {
          type: "boolean",
          title: "Raw Output",
          description:
            "Whether or not to return use the result of execution as raw output (true) or as a port called `result` (false). Default is false.",
          default: false,
          behavior: ["config"],
        },
        schema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "schema",
          description:
            "Deprecated! Please use inputSchema/outputSchema instead. The schema of the output data.",
          behavior: ["config", "ports-spec", "deprecated"],
        },
      },
      required: ["code"],
    },
    outputSchema: {
      type: "object",
      properties: {
        bar: {
          type: "number",
        },
      },
      required: [],
    },
  });
});

test("raw=true without provided schemas", async (t) => {
  const result = await handler.describe({ raw: true });
  t.deepEqual(result, {
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          title: "Code",
          description: "The JavaScript code to run",
          format: "javascript",
          behavior: ["config", "hint-code"],
        },
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Input Schema",
          description: "The schema of the input data, the function arguments.",
          behavior: ["config", "ports-spec"],
        },
        name: {
          type: "string",
          title: "Function Name",
          description:
            'The name of the function to invoke in the supplied code. Default value is "run".',
          default: "run",
          behavior: ["config"],
        },
        outputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Output Schema",
          description:
            "The schema of the output data, the shape of the object of the function return value.",
          behavior: ["config", "ports-spec"],
        },
        raw: {
          type: "boolean",
          title: "Raw Output",
          description:
            "Whether or not to return use the result of execution as raw output (true) or as a port called `result` (false). Default is false.",
          default: false,
          behavior: ["config"],
        },
        schema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "schema",
          description:
            "Deprecated! Please use inputSchema/outputSchema instead. The schema of the output data.",
          behavior: ["config", "ports-spec", "deprecated"],
        },
      },
      required: ["code"],
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

test("raw=false with provided schemas", async (t) => {
  const result = await handler.describe({
    raw: false,
    inputSchema: {
      type: "object",
      properties: { foo: { type: "string" } },
    },
    outputSchema: {
      type: "object",
      properties: { result: { type: "number" } },
    },
  });
  t.deepEqual(result, {
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          title: "Code",
          description: "The JavaScript code to run",
          format: "javascript",
          behavior: ["config", "hint-code"],
        },
        foo: {
          type: "string",
        },
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Input Schema",
          description: "The schema of the input data, the function arguments.",
          behavior: ["config", "ports-spec"],
        },
        name: {
          type: "string",
          title: "Function Name",
          description:
            'The name of the function to invoke in the supplied code. Default value is "run".',
          default: "run",
          behavior: ["config"],
        },
        outputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Output Schema",
          description:
            "The schema of the output data, the shape of the object of the function return value.",
          behavior: ["config", "ports-spec"],
        },
        raw: {
          type: "boolean",
          title: "Raw Output",
          description:
            "Whether or not to return use the result of execution as raw output (true) or as a port called `result` (false). Default is false.",
          default: false,
          behavior: ["config"],
        },
        schema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "schema",
          description:
            "Deprecated! Please use inputSchema/outputSchema instead. The schema of the output data.",
          behavior: ["config", "ports-spec", "deprecated"],
        },
      },
      required: ["code"],
    },
    outputSchema: {
      type: "object",
      properties: {
        result: {
          description: "The result of running the JavaScript code",
          title: "Result",
          type: "number",
        },
      },
      additionalProperties: false,
      required: [],
    },
  });
});

test("raw=false without provided schemas", async (t) => {
  const result = await handler.describe({ raw: false });
  t.deepEqual(result, {
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          title: "Code",
          description: "The JavaScript code to run",
          format: "javascript",
          behavior: ["config", "hint-code"],
        },
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Input Schema",
          description: "The schema of the input data, the function arguments.",
          behavior: ["config", "ports-spec"],
        },
        name: {
          type: "string",
          title: "Function Name",
          description:
            'The name of the function to invoke in the supplied code. Default value is "run".',
          default: "run",
          behavior: ["config"],
        },
        outputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "Output Schema",
          description:
            "The schema of the output data, the shape of the object of the function return value.",
          behavior: ["config", "ports-spec"],
        },
        raw: {
          type: "boolean",
          title: "Raw Output",
          description:
            "Whether or not to return use the result of execution as raw output (true) or as a port called `result` (false). Default is false.",
          default: false,
          behavior: ["config"],
        },
        schema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: true,
          title: "schema",
          description:
            "Deprecated! Please use inputSchema/outputSchema instead. The schema of the output data.",
          behavior: ["config", "ports-spec", "deprecated"],
        },
      },
      required: ["code"],
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: {
        result: {
          description: "The result of running the JavaScript code",
          title: "Result",
          type: ["array", "boolean", "null", "number", "object", "string"],
        },
      },
      required: [],
      additionalProperties: false,
    },
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
