/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import test from "ava";

import { recipe, code } from "../../../src/new/recipe-grammar/recipe.js";
import { Serializeable } from "../../../src/new/runner/types.js";
import {
  InputValues,
  OutputValues,
  BoardRunner,
  asRuntimeKit,
} from "../../../src/index.js";

import { TestKit, testKit } from "../../helpers/_test-kit.js";

async function serializeAndRunGraph(
  graph: Serializeable,
  inputs: InputValues
): Promise<OutputValues> {
  const board = await BoardRunner.fromGraphDescriptor(await graph.serialize());
  return board.runOnce(inputs, { kits: [asRuntimeKit(TestKit)] });
}

test("simplest graph", async (t) => {
  const graph = recipe((inputs) => {
    return testKit.noop(inputs);
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest graph, spread", async (t) => {
  const graph = recipe((inputs) => {
    return testKit.noop({ ...inputs });
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest graph, pick input", async (t) => {
  const graph = recipe((inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("simplest graph, pick input and output", async (t) => {
  const graph = recipe((inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.like(result, { foo: "bar" });
});

test("two nodes, spread", async (t) => {
  const graph = recipe<{ [key: string]: string }>((inputs) => {
    const reverser = testKit.reverser({ ...inputs });
    return testKit.noop({ ...reverser });
  });
  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.deepEqual(result, { foo: "rab" });
});

test("simple inline code", async (t) => {
  const graph = recipe<{ a: number; b: number }, { result: number }>(
    (inputs) => {
      return code<{ a: number; b: number }, { result: number }>(
        async (inputs) => {
          const { a, b } = await inputs;
          return { result: a + b };
        }
      )({ a: inputs.a, b: inputs.b });
    }
  );

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.deepEqual(result, { result: 3 });
});

test("simple inline code, declare and cast types w/o contradiction", async (t) => {
  const graph = recipe<{ a: number; b: number }, { result: number }>(
    (inputs) => {
      return {
        result: code<{ a: number; b: number }, { result: number }>(
          ({ a, b }) => {
            return { result: a + b };
          }
        )({ a: inputs.a.isNumber(), b: inputs.b.isNumber() }).result.isNumber(),
      };
    }
  );

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.like(result, { result: 3 });
  t.like(result, { schema: { properties: { result: { type: "number" } } } });
});

test("simple inline code, cast types and infer in TypeScript", async (t) => {
  const graph = recipe((inputs) => {
    return {
      result: code(({ a, b }) => {
        // TODO: Get rid of this extra cast, it shouldn't be necessary
        return { result: (a as number) + (b as number) };
      })({ a: inputs.a.isNumber(), b: inputs.b.isNumber() }).result.isNumber(),
    };
  });

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.like(result, { result: 3 });
  t.like(result, { schema: { properties: { result: { type: "number" } } } });
});

test("simple inline code, single parameter", async (t) => {
  const graph = recipe<{ number: number }, { result: number }>((inputs) => {
    return code<{ number: number }>((inputs) => {
      return { result: -inputs.number };
    })(inputs);
  });

  const result = await serializeAndRunGraph(graph, { number: 3 });
  t.deepEqual(result, { result: -3 });
});

test("simple inline code, single parameter, pick", async (t) => {
  const graph = recipe<{ number: number }, { result: number }>(({ number }) => {
    return code<{ number: number }>((inputs) => {
      return { result: -inputs.number };
    })(number);
  });

  const result = await serializeAndRunGraph(graph, { number: 3 });
  t.deepEqual(result, { result: -3 });
});

test("simple inline code, explicit input and output, single parameter", async (t) => {
  const graph = recipe((_, base) => {
    const inputs = base.input({
      schema: {
        properties: { foo: { type: "string" } },
        required: ["foo"],
      },
    });
    const neg = code(({ foo }) => {
      return { result: `${foo}!!` };
    })(inputs);
    const outputs = base.output({});
    neg.result.to(outputs);
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.like(result, { result: "bar!!" });
});

test("simple inline code, explicit input and output, single parameter, pick", async (t) => {
  const graph = recipe((_, base) => {
    const inputs = base.input({
      schema: {
        properties: { foo: { type: "string" } },
        required: ["foo"],
      },
    });
    const neg = code(({ foo }) => {
      return { result: `${foo}!!` };
    })(inputs.foo);
    const outputs = base.output({});
    neg.result.to(outputs);
  });

  const result = await serializeAndRunGraph(graph, { foo: "bar" });
  t.like(result, { result: "bar!!" });
});

test("code recipe called from another recipe", async (t) => {
  const add = code<{ a: number; b: number }, { result: number }>((inputs) => {
    const { a, b } = inputs;
    return { result: a + b };
  });

  const graph = recipe<{ a: number; b: number }, { result: number }>(
    (inputs) => {
      return add({ a: inputs.a, b: inputs.b });
    }
  );

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.deepEqual(result, { result: 3 });
});

test("nested inline action, with schema", async (t) => {
  const graph = recipe(
    {
      input: z.object({
        a: z.number().describe("A: One Number"),
        b: z.number().describe("B: Another number"),
      }),
      output: z.object({
        result: z.number().describe("Sum: The sum of two numbers"),
      }),
    },
    (inputs) => {
      return code<{ a: number; b: number }, { result: number }>(
        async (inputs) => {
          const { a, b } = await inputs;
          return { result: a + b };
        }
      )({ a: inputs.a, b: inputs.b });
    }
  );

  const result = await serializeAndRunGraph(graph, { a: 1, b: 2 });
  t.deepEqual(result, {
    result: 3,
    schema: {
      type: "object",
      properties: {
        result: {
          type: "number",
          title: "Sum",
          description: "The sum of two numbers",
        },
      },
      required: ["result"],
      additionalProperties: false,
    },
  });
});
