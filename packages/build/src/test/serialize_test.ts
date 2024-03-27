/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import assert from "node:assert/strict";
import { test } from "node:test";
import { board, type GenericBoardDefinition } from "../internal/board/board.js";
import { serialize } from "../internal/board/serialize.js";
import type { GraphDescriptor } from "@google-labs/breadboard";
import { anyOf, array, defineNodeType, object } from "../index.js";
import { input } from "../internal/board/input.js";

function checkSerialization(
  board: GenericBoardDefinition,
  expected: GraphDescriptor
) {
  const actual = serialize(board);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.log(
      `\nActual:\n==========\n` + JSON.stringify(actual) + `\n==========\n`
    );
  }
  assert.deepEqual(actual, expected);
  // Additionally check that the order of properties is what we expect. Having
  // deterministic string serialization is a nice property to have.
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test("0 inputs, 1 output", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {},
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({});
  checkSerialization(board({}, { boardOut: myNode.outputs.myNodeOut }), {
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              boardOut: { type: "string" },
            },
            required: ["boardOut"],
          },
        },
      },
      {
        id: "myNode-0",
        type: "myNode",
        configuration: {},
      },
    ],
    edges: [
      { from: "myNode-0", out: "myNodeOut", to: "output-0", in: "boardOut" },
    ],
  });
});

test("node with primary output can itself act as that output", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {},
    outputs: {
      myNodeOutPrimary: { type: "string", primary: true },
    },
    invoke: () => ({ myNodeOutPrimary: "aaa" }),
  })({});
  checkSerialization(board({}, { boardOut: myNode }), {
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              boardOut: { type: "string" },
            },
            required: ["boardOut"],
          },
        },
      },
      {
        id: "myNode-0",
        type: "myNode",
        configuration: {},
      },
    ],
    edges: [
      {
        from: "myNode-0",
        out: "myNodeOutPrimary",
        to: "output-0",
        in: "boardOut",
      },
    ],
  });
});

test("raw value input is serialized to configuration", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      myNodeIn: { type: "string" },
    },
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({
    myNodeIn: "bbb",
  });
  checkSerialization(board({}, { boardOut: myNode.outputs.myNodeOut }), {
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { boardOut: { type: "string" } },
            required: ["boardOut"],
          },
        },
      },
      {
        id: "myNode-0",
        type: "myNode",
        configuration: {
          myNodeIn: "bbb",
          //        ^^^^^ here it is
        },
      },
    ],
    edges: [
      { from: "myNode-0", out: "myNodeOut", to: "output-0", in: "boardOut" },
    ],
  });
});

test("input", () => {
  const myInput = input();
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      myNodeIn: { type: "string" },
    },
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({
    myNodeIn: myInput,
  });
  checkSerialization(
    board({ myInput }, { boardOut: myNode.outputs.myNodeOut }),
    {
      nodes: [
        {
          id: "input-0",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                myInput: { type: "string" },
              },
              required: ["myInput"],
            },
          },
        },
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardOut: { type: "string" },
              },
              required: ["boardOut"],
            },
          },
        },
        {
          id: "myNode-0",
          type: "myNode",
          configuration: {},
        },
      ],
      edges: [
        { from: "input-0", out: "myInput", to: "myNode-0", in: "myNodeIn" },
        { from: "myNode-0", out: "myNodeOut", to: "output-0", in: "boardOut" },
      ],
    }
  );
});

test("input with default", () => {
  const myInput = input({ default: "ccc" });
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      myNodeIn: { type: "string" },
    },
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({
    myNodeIn: myInput,
  });
  checkSerialization(
    board({ myInput }, { boardOut: myNode.outputs.myNodeOut }),
    {
      nodes: [
        {
          id: "input-0",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                myInput: {
                  type: "string",
                  default: "ccc",
                  //       ^^^^^ here it is!
                },
              },
              required: ["myInput"],
            },
          },
        },
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardOut: { type: "string" },
              },
              required: ["boardOut"],
            },
          },
        },
        {
          id: "myNode-0",
          type: "myNode",
          configuration: {},
        },
      ],
      edges: [
        { from: "input-0", out: "myInput", to: "myNode-0", in: "myNodeIn" },
        { from: "myNode-0", out: "myNodeOut", to: "output-0", in: "boardOut" },
      ],
    }
  );
});

test("fancy types", () => {
  const fancyType1 = anyOf("number", object({ foo: "boolean" }));
  const fancyType2 = array(anyOf("string", object({ foo: "number" })));
  const fancyType3 = object({ foo: anyOf("string", array("boolean")) });
  const myInput1 = input({ type: fancyType1 });
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      myNodeIn1: { type: fancyType1 },
      myNodeIn2: { type: fancyType2 },
    },
    outputs: {
      myNodeOut: { type: fancyType3 },
    },
    invoke: () => ({ myNodeOut: { foo: [true, false] } }),
  })({
    myNodeIn1: myInput1,
    myNodeIn2: ["aaa", { foo: 123 }],
  });
  checkSerialization(
    board({ boardInput1: myInput1 }, { boardOut: myNode.outputs.myNodeOut }),
    {
      nodes: [
        {
          id: "input-0",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardInput1: {
                  anyOf: [
                    { type: "number" },
                    {
                      type: "object",
                      properties: { foo: { type: "boolean" } },
                      required: ["foo"],
                    },
                  ],
                  title: "myNodeIn1",
                },
              },
              required: ["boardInput1"],
            },
          },
        },
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardOut: {
                  type: "object",
                  properties: {
                    foo: {
                      anyOf: [
                        { type: "string" },
                        { type: "array", items: { type: "boolean" } },
                      ],
                    },
                  },
                  required: ["foo"],
                  title: "myNodeOut",
                },
              },
              required: ["boardOut"],
            },
          },
        },
        {
          id: "myNode-0",
          type: "myNode",
          configuration: {
            myNodeIn2: ["aaa", { foo: 123 }],
          },
        },
      ],
      edges: [
        {
          from: "input-0",
          out: "boardInput1",
          to: "myNode-0",
          in: "myNodeIn1",
        },
        {
          from: "myNode-0",
          out: "myNodeOut",
          to: "output-0",
          in: "boardOut",
        },
      ],
    }
  );
});

test("long chain", () => {
  const numInput = input({ type: "number" });

  const numToString = defineNodeType({
    name: "numToString",
    inputs: {
      in: { type: "number" },
    },
    outputs: {
      out: { type: "string", primary: true },
    },
    invoke: () => ({ out: "aaa" }),
  })({
    in: numInput,
  });

  const stringToBool = defineNodeType({
    name: "stringToBool",
    inputs: {
      in: { type: "string" },
    },
    outputs: {
      out: { type: "boolean", primary: true },
    },
    invoke: () => ({ out: true }),
  })({
    in: numToString,
  });

  const boolToStringArray = defineNodeType({
    name: "boolToStringArray",
    inputs: {
      in: { type: "boolean" },
    },
    outputs: {
      out: { type: array("string"), primary: true },
    },
    invoke: () => ({ out: ["aaa", "bbb"] }),
  })({
    in: stringToBool,
  });

  checkSerialization(
    board(
      { boardNumInput: numInput },
      { boardStringArrayOut: boolToStringArray }
    ),
    {
      nodes: [
        {
          id: "input-0",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: { boardNumInput: { type: "number" } },
              required: ["boardNumInput"],
            },
          },
        },
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardStringArrayOut: {
                  type: "array",
                  items: { type: "string" },
                  title: "out",
                },
              },
              required: ["boardStringArrayOut"],
            },
          },
        },
        {
          id: "boolToStringArray-0",
          type: "boolToStringArray",
          configuration: {},
        },
        {
          id: "numToString-0",
          type: "numToString",
          configuration: {},
        },
        {
          id: "stringToBool-0",
          type: "stringToBool",
          configuration: {},
        },
      ],
      edges: [
        {
          from: "boolToStringArray-0",
          out: "out",
          to: "output-0",
          in: "boardStringArrayOut",
        },
        {
          from: "input-0",
          out: "boardNumInput",
          to: "numToString-0",
          in: "in",
        },
        { from: "numToString-0", out: "out", to: "stringToBool-0", in: "in" },
        {
          from: "stringToBool-0",
          out: "out",
          to: "boolToStringArray-0",
          in: "in",
        },
      ],
    }
  );
});

test("error: input not passed to board", () => {
  const myInput = input();
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      myNodeIn: { type: "string" },
    },
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({
    myNodeIn: myInput,
  });
  assert.throws(
    () => serialize(board({}, { boardOut: myNode.outputs.myNodeOut })),
    /myNode-0:myNodeIn was wired to an input, but that input was not provided to the board inputs./
  );
});

test("error: same input used twice", () => {
  const myInput = input();
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      myNodeIn: { type: "string" },
    },
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({
    myNodeIn: myInput,
  });
  assert.throws(
    () =>
      serialize(
        board(
          { boardInput1: myInput, boardInput2: myInput },
          { boardOut: myNode.outputs.myNodeOut }
        )
      ),
    /The same input was used as both boardInput1 and boardInput2/
  );
});

test("error: input not reachable from output", () => {
  const myInput = input();
  const myOrphanInput = input();
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      myNodeIn: { type: "string" },
    },
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({
    myNodeIn: myInput,
  });
  assert.throws(
    () =>
      serialize(
        board(
          { boardInput1: myInput, boardInput2: myOrphanInput },
          { boardOut: myNode.outputs.myNodeOut }
        )
      ),
    /Board input "boardInput2" is not reachable from any of its outputs./
  );
});
