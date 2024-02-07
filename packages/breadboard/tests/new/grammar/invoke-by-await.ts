/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { board, code } from "../../../src/new/grammar/board.js";
import { V } from "../../../src/index.js";
import { testKit } from "../../helpers/_test-kit.js";

test("directly await a node", async (t) => {
  const { foo } = await testKit.noop({ foo: "bar" });
  t.is(foo, "bar");
});

test("directly await a value", async (t) => {
  const foo = await testKit.noop({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await a value called 'to'", async (t) => {
  const to = (await testKit.noop({ to: "foo" }).to) as unknown as string;
  t.is(to, "foo");
});

test("directly await declarative board returning node, value assignment", async (t) => {
  const graph = board((inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await declarative board returning node, deconstruct", async (t) => {
  const graph = board<{ foo: string }>((inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const { foo } = await graph({ foo: "bar" });
  t.is(foo, "bar");
});

test("directly await declarative board, value assignment", async (t) => {
  const graph = board((inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await declarative board, values named 'in' and 'to'", async (t) => {
  const graph = board<{ in: string }, { to: unknown }>((inputs) => {
    const { to } = testKit.noop({ to: inputs.in });
    return { to: to as unknown as V<string> };
  });
  const to = await graph({ in: "bar" }).to;
  t.is(to, "bar");
});

test("directly await declarative board, deconstruct", async (t) => {
  const graph = board((inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const { foo } = await graph({ foo: "bar" });
  t.is(foo as unknown as string, "bar");
});

test("directly await declarative board, deconstruct, 'in' and 'to'", async (t) => {
  const graph = board((inputs) => {
    const { to } = testKit.noop({ to: inputs.in });
    return { to: to as unknown as V<string> };
  });
  const { to } = await graph({ in: "bar" });
  t.is(to as unknown as string, "bar");
});

test("directly await declarative board, passing full inputs, value", async (t) => {
  const graph = board((inputs) => {
    return testKit.noop(inputs);
  });
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz, "bar");
});

test("directly await declarative board, passing full inputs, deconstruct", async (t) => {
  const graph = board<{ [key: string]: unknown }>((inputs) => {
    return testKit.noop(inputs);
  });
  const { baz } = await graph({ baz: "bar" });
  t.is(baz, "bar");
});

test("directly await declarative board, passing full inputs as spread", async (t) => {
  const graph = board((inputs) => {
    return testKit.noop({ ...inputs });
  });
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz, "bar");
});

test("directly await declarative board, passing full inputs as spread, twice", async (t) => {
  const graph = board<{ [key: string]: string }>((inputs) => {
    const reverser = testKit.reverser({ ...inputs });
    return testKit.noop({ ...reverser });
  });
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz as unknown as string, "rab");
});

test("directly await imperative board, value assignment", async (t) => {
  const graph = code(async (inputs) => {
    const { foo } = await testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await imperative board, deconstruct", async (t) => {
  const graph = code(async (inputs) => {
    const { foo } = await testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const { foo } = await graph({ foo: "bar" });
  t.is(foo, "bar");
});

test("if-else, imperative execution", async (t) => {
  const math = code(async () => {
    return { result: "math result" };
  });
  const search = code(async () => {
    return { text: "search result" };
  });

  const graph = board({
    input: {
      type: "object",
      required: ["question"],
      properties: {
        question: {
          type: "string",
          title: "Query",
          description: "A math or search question?",
        },
      },
    },
    output: {
      type: "object",
      required: ["result"],
      properties: {
        result: {
          type: "string",
          title: "Answer",
          description: "The answer to the query",
        },
      },
    },
    invoke: async (inputs) => {
      const { text } = (await testKit
        .noop({
          template:
            "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
          question: inputs.question,
        })
        .question.as("text")
        .to(
          testKit.noop({
            PALM_KEY: testKit.noop({ PALM_KEY: "dummy" }).PALM_KEY,
          })
        )) as { text: string };

      if (text?.startsWith("YES")) {
        return {
          result: (await math({ question: inputs.question }).result) ?? "",
        };
      } else {
        return {
          result: (await search({ text: inputs.question }).text) ?? "",
        };
      }
    },
  });

  {
    const { result } = await graph({ question: "YES it is" });
    t.is(result, "math result");
  }

  {
    const { result } = await graph({ question: "NO it is" });
    t.is(result, "search result");
  }
});

test.skip("if-else, serializable", async (t) => {
  const math = code(async () => {
    return { result: "math result" };
  });
  const search = code(async () => {
    return { text: "search result" };
  });

  const graph = board(
    {
      input: {
        type: "object",
        required: ["question"],
        properties: {
          question: {
            type: "string",
            title: "Query",
            description: "A math or search question?",
          },
        },
      },
      output: {
        type: "object",
        required: ["result"],
        properties: {
          result: {
            type: "string",
            title: "Answer",
            description: "The answer to the query",
          },
        },
      },
    },
    (inputs) =>
      testKit
        .noop({
          template:
            "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
          question: inputs.question,
        })
        .question.as("text")
        .to(
          testKit.noop({
            PALM_KEY: testKit.noop({ PALM_KEY: "dummy" }).PALM_KEY,
          })
        )
        .to(
          async (inputs) => {
            const { text, math, search } = await inputs;
            if ((text as string)?.startsWith("YES")) {
              return {
                result: math({ question: inputs.question }).result,
              };
            } else {
              return {
                result: search({ text: inputs.question }).text,
              };
            }
          },
          { math, search }
        )
  );

  {
    const { result } = await graph({ question: "YES it is" });
    t.is(result, "math result");
  }

  {
    const { result } = await graph({ question: "NO it is" });
    t.is(result, "search result");
  }
});
