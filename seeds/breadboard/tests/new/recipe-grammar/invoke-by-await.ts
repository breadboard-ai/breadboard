/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import test from "ava";

import { recipe } from "../../../src/new/recipe-grammar/recipe.js";
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

test("directly await declarative recipe returning node, value assignment", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await declarative recipe returning node, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const { foo } = await graph({ foo: "bar" });
  t.is(foo, "bar");
});

test("directly await declarative recipe, value assignment", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await declarative recipe, values named 'in' and 'to'", async (t) => {
  const graph = recipe<{ in: string }, { to: unknown }>(async (inputs) => {
    const { to } = testKit.noop({ to: inputs.in });
    return { to };
  });
  const to = await graph({ in: "bar" }).to;
  t.is(to, "bar");
});

test("directly await declarative recipe, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const { foo } = await graph({ foo: "bar" });
  t.is(foo as unknown as string, "bar");
});

test("directly await declarative recipe, deconstruct, 'in' and 'to'", async (t) => {
  const graph = recipe(async (inputs) => {
    const { to } = testKit.noop({ to: inputs.in });
    return { to };
  });
  const { to } = await graph({ in: "bar" });
  t.is(to as unknown as string, "bar");
});

test("directly await declarative recipe, passing full inputs, value", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop(inputs);
  });
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz, "bar");
});

test("directly await declarative recipe, passing full inputs, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop(inputs);
  });
  const { baz } = await graph({ baz: "bar" });
  t.is(baz, "bar");
});

test("directly await declarative recipe, passing full inputs as spread", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ ...inputs });
  });
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz, "bar");
});

test.skip("directly await declarative recipe, passing full inputs as spread, twice", async (t) => {
  const graph = recipe<{ [key: string]: string }>(async (inputs) => {
    const reverser = testKit.reverser({ ...inputs });
    return testKit.noop({ ...reverser });
  });
  t.log(await graph.serialize());
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz as unknown as string, "rab");
});

test("directly await imperative recipe, value assignment", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = await testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await imperative recipe, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = await testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const { foo } = await graph({ foo: "bar" });
  t.is(foo, "bar");
});

test("if-else, imperative execution", async (t) => {
  const math = recipe(async () => {
    return { result: "math result" };
  });
  const search = recipe(async () => {
    return { text: "search result" };
  });

  const graph = recipe(
    {
      input: z.object({
        question: z.string().describe("Query: A math or search question?"),
      }),
      output: z.object({
        result: z.string().describe("Answer: The answer to the query"),
      }),
    },
    async (inputs) => {
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
    }
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

test.skip("if-else, serializable", async (t) => {
  const math = recipe(async () => {
    return { result: "math result" };
  });
  const search = recipe(async () => {
    return { text: "search result" };
  });

  const graph = recipe(
    {
      input: z.object({
        question: z.string().describe("Query: A math or search question?"),
      }),
      output: z.object({
        result: z.string().describe("Answer: The answer to the query"),
      }),
    },
    async (inputs) => {
      return testKit
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
        .result.to(testKit.noop()) as unknown as PromiseLike<{
        result: string;
      }>;
    }
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
