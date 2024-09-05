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
import { board as oldBoard } from "@google-labs/breadboard";

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

const testKit = kit({
  title: "test_title",
  url: "test_url",
  version: "test_version",
  description: "test_description",
  components: {
    foo: testDiscrete,
    bar: testBoard,
  },
});

test("kit handles discrete component", () => {
  assert.ok(
    // $ExpectType Definition<{ str: string; }, { str: string; }, undefined, undefined, never, false, false, false, { str: { board: false; }; }>
    testKit.foo
  );
  assert.equal(testKit.foo.id, "foo");
  assert.equal(testKit.foo.metadata.description, "Discrete Description");
});

test("kit handles board component", () => {
  assert.ok(
    // $ExpectType BoardDefinition<{ num: number; }, { num: number; }>
    testKit.bar
  );
  assert.equal(testKit.bar.id, "bar");
  assert.equal(testKit.bar.description, "Board Description");
});

test("can invoke discrete component through board with old API", async () => {
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

test("can invoke board component through board with old API", async () => {
  const legacyTestKit = await testKit.legacy();
  const oldBoardInstance = await oldBoard(() => {
    const bb = legacyTestKit.bar({ num: 32 });
    return {
      num: bb.num,
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
