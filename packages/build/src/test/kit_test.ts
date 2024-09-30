/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { board } from "../internal/board/board.js";
import { input } from "../internal/board/input.js";
import { defineNodeType } from "../internal/define/define.js";
import { kit } from "../internal/kit.js";
import {
  board as oldBoard,
  type GraphDescriptor,
  type Kit,
  type KitConstructor,
  type NodeFactory,
  type NodeHandlerObject,
} from "@google-labs/breadboard";
import { serialize } from "../internal/board/serialize.js";

const testDiscrete = defineNodeType({
  name: "discreteComponent",
  metadata: {
    description: "Discrete Description",
  },
  inputs: {
    str: {
      type: "string",
    },
  },
  outputs: {
    str: {
      type: "string",
    },
  },
  invoke: ({ str }) => ({ str }),
});

const numInput = input({ type: "number" });
const testBoard = board({
  id: "boardComponent",
  description: "Board Description",
  inputs: { num: numInput },
  outputs: { num: numInput },
});

const testDescriptor: GraphDescriptor = {
  title: "BGL Title",
  description: "BGL Description",
  metadata: {
    icon: "robot",
  },
  nodes: [],
  edges: [],
};

const testKit = await kit({
  title: "test_title",
  url: "test_url",
  version: "test_version",
  description: "test_description",
  components: {
    foo: testDiscrete,
    bar: testBoard,
    baz: testDescriptor,
  },
});

test("is a kit", () => {
  testKit satisfies Kit & {
    handlers: { foo: NodeHandlerObject; bar: NodeHandlerObject };
  };
  assert.deepEqual(Object.keys(testKit.handlers), ["foo", "bar", "baz"]);
  const { foo, bar, baz } = testKit.handlers;
  assert.equal(typeof foo.invoke, "function");
  assert.equal(typeof bar.invoke, "function");
  assert.equal(typeof baz.invoke, "function");
  assert.equal(typeof foo.describe, "function");
  assert.equal(typeof bar.describe, "function");
  assert.equal(typeof baz.describe, "function");
});

test("is a kit factory for itself", () => {
  testKit satisfies KitConstructor<
    Kit & {
      handlers: { foo: NodeHandlerObject; bar: NodeHandlerObject };
    }
  >;
  const instantiatedTestKit = new testKit(undefined as unknown as NodeFactory);
  assert.deepEqual(Object.keys(instantiatedTestKit.handlers), [
    "foo",
    "bar",
    "baz",
  ]);
  const { foo, bar, baz } = instantiatedTestKit.handlers;
  assert.equal(typeof foo.invoke, "function");
  assert.equal(typeof bar.invoke, "function");
  assert.equal(typeof baz.invoke, "function");
  assert.equal(typeof foo.describe, "function");
  assert.equal(typeof bar.describe, "function");
  assert.equal(typeof baz.describe, "function");
});

test("kit handles discrete component", () => {
  assert.ok(
    // $ExpectType Definition<{ str: string; }, { str: string; }, undefined, undefined, never, false, false, false, { str: { board: false; }; }>
    testKit.foo
  );
  assert.equal(testKit.foo.metadata.description, "Discrete Description");
});

test("kit handles board component", () => {
  assert.ok(
    // $ExpectType BoardDefinition<{ num: number; }, { num: number; }>
    testKit.bar
  );
  assert.equal(testKit.bar.description, "Board Description");
});

test("kit handles BGL component", () => {
  assert.ok(
    // $ExpectType GraphDescriptor
    testKit.baz
  );
  assert.equal(testKit.baz.title, "BGL Title");
  assert.equal(testKit.baz.description, "BGL Description");
  assert.equal(testKit.baz.metadata?.icon, "robot");
});

test("can invoke discrete component with old API", async () => {
  const legacyTestKit = await testKit.legacy();
  const oldBoardInstance = await oldBoard(() => {
    const node = legacyTestKit.foo({ str: "foo" });
    return {
      str: node.str,
    };
  });
  const bgl = await oldBoardInstance.serialize();
  assert.deepEqual(bgl, {
    nodes: [
      {
        id: "output-2",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              str: {
                title: "str",
                type: "string",
              },
            },
          },
        },
      },
      {
        id: "foo-3",
        type: "foo",
        configuration: {
          str: "foo",
        },
      },
    ],
    edges: [
      {
        from: "foo-3",
        out: "str",
        to: "output-2",
        in: "str",
      },
    ],
    graphs: {},
  });
});

test("can invoke board component with old API", async () => {
  const legacyTestKit = await testKit.legacy();
  const oldBoardInstance = await oldBoard(() => {
    const num = legacyTestKit.bar({ num: 32 });
    return {
      num,
    };
  });
  const bgl = await oldBoardInstance.serialize();
  assert.deepEqual(bgl, {
    nodes: [
      {
        id: "output-2",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              num: {
                title: "num",
                type: "number",
              },
            },
          },
        },
      },
      {
        id: "bar-3",
        type: "bar",
        configuration: {
          num: 32,
        },
      },
    ],
    edges: [
      {
        from: "bar-3",
        out: "num",
        to: "output-2",
        in: "num",
      },
    ],
    graphs: {},
  });
});

test("can invoke discrete component with new API", () => {
  const str = testKit.foo({ str: "foo" }).outputs.str;
  const newBoardInstance = board({ inputs: {}, outputs: { str } });
  const bgl = serialize(newBoardInstance);
  assert.deepEqual(bgl, {
    nodes: [
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              str: {
                type: "string",
              },
            },
            required: ["str"],
          },
        },
      },
      {
        id: "foo-0",
        type: "foo",
        configuration: {
          str: "foo",
        },
      },
    ],
    edges: [
      {
        from: "foo-0",
        out: "str",
        to: "output-0",
        in: "str",
      },
    ],
  });
});

test("can invoke board component with new API", () => {
  const num = testKit.bar({ num: 32 }).outputs.num;
  const newBoardInstance = board({ inputs: {}, outputs: { num } });
  const bgl = serialize(newBoardInstance);
  assert.deepEqual(bgl, {
    nodes: [
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              num: {
                type: "number",
              },
            },
            required: ["num"],
          },
        },
      },
      {
        id: "bar-0",
        type: "bar",
        configuration: {
          num: 32,
        },
      },
    ],
    edges: [
      {
        from: "bar-0",
        out: "num",
        to: "output-0",
        in: "num",
      },
    ],
  });
});
