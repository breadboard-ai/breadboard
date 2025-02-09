/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import type { GraphDescriptor } from "@google-labs/breadboard";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anyOf,
  array,
  defineNodeType,
  object,
  optionalEdge,
  output,
  unsafeCast,
  type SerializableBoard,
} from "../index.js";
import { board, outputNode } from "../internal/board/board.js";
import { constant } from "../internal/board/constant.js";
import { input } from "../internal/board/input.js";
import { loopback } from "../internal/board/loopback.js";
import { serialize } from "../internal/board/serialize.js";

function checkSerialization(
  board: SerializableBoard,
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
  checkSerialization(
    board({
      inputs: {},
      outputs: { boardOut: myNode.outputs.myNodeOut },
    }),
    {
      edges: [
        { from: "myNode-0", to: "output-0", out: "myNodeOut", in: "boardOut" },
      ],
      nodes: [
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
    }
  );
});

test("monomorphic node with primary output can itself act as that output", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {},
    outputs: {
      myNodeOutPrimary: { type: "string", primary: true },
    },
    invoke: () => ({ myNodeOutPrimary: "aaa" }),
  })({});
  checkSerialization(
    board({
      inputs: {},
      outputs: { boardOut: myNode },
    }),
    {
      edges: [
        {
          from: "myNode-0",
          to: "output-0",
          out: "myNodeOutPrimary",
          in: "boardOut",
        },
      ],
      nodes: [
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
    }
  );
});

test("polymorphic node with primary output can itself act as that output", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      "*": {
        type: "number",
      },
    },
    outputs: {
      myNodeOutPrimary: { type: "string", primary: true },
    },
    invoke: () => ({ myNodeOutPrimary: "aaa" }),
  })({});
  checkSerialization(
    board({
      inputs: {},
      outputs: { boardOut: myNode },
    }),
    {
      edges: [
        {
          from: "myNode-0",
          to: "output-0",
          out: "myNodeOutPrimary",
          in: "boardOut",
        },
      ],
      nodes: [
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
    }
  );
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
  checkSerialization(
    board({ inputs: {}, outputs: { boardOut: myNode.outputs.myNodeOut } }),
    {
      edges: [
        { from: "myNode-0", to: "output-0", out: "myNodeOut", in: "boardOut" },
      ],
      nodes: [
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
    }
  );
});

test("default value input is omitted from configuration", () => {
  const d = defineNodeType({
    name: "myNode",
    inputs: {
      required: { type: "string" },
      optional: { type: "string", default: "foo" },
    },
    outputs: {
      out: { type: "string" },
    },
    invoke: () => ({ out: "foo" }),
  });

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        boardOut: d({
          required: "foo",
        }).outputs.out,
      },
    }),
    {
      edges: [{ from: "myNode-0", to: "output-0", out: "out", in: "boardOut" }],
      nodes: [
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
          configuration: {
            required: "foo",
          },
        },
      ],
    }
  );

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        boardOut: d({
          required: "foo",
          optional: "bar",
        }).outputs.out,
      },
    }),
    {
      edges: [{ from: "myNode-0", to: "output-0", out: "out", in: "boardOut" }],
      nodes: [
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
          configuration: {
            optional: "bar",
            required: "foo",
          },
        },
      ],
    }
  );
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
    board({
      inputs: { myInput },
      outputs: { boardOut: myNode.outputs.myNodeOut },
    }),
    {
      edges: [
        { from: "input-0", to: "myNode-0", out: "myInput", in: "myNodeIn" },
        { from: "myNode-0", to: "output-0", out: "myNodeOut", in: "boardOut" },
      ],
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
    board({
      inputs: { myInput },
      outputs: { boardOut: myNode.outputs.myNodeOut },
    }),
    {
      edges: [
        { from: "input-0", to: "myNode-0", out: "myInput", in: "myNodeIn" },
        { from: "myNode-0", to: "output-0", out: "myNodeOut", in: "boardOut" },
      ],
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
    }
  );
});

test("input with examples", () => {
  const myInput = input({ examples: ["example 1", "example 2"] });
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
    board({
      inputs: { myInput },
      outputs: { boardOut: myNode.outputs.myNodeOut },
    }),
    {
      edges: [
        { from: "input-0", to: "myNode-0", out: "myInput", in: "myNodeIn" },
        { from: "myNode-0", to: "output-0", out: "myNodeOut", in: "boardOut" },
      ],
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
                  examples: ["example 1", "example 2"],
                  //        ^^^^^^^^^^^^^^^^^^^^^^^^^^ here it is!
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
    }
  );
});

test("input with title and description", () => {
  const myInput = input({
    title: "This is my title",
    description: "This is my description",
  });
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
    board({
      inputs: { myInput },
      outputs: { boardOut: myNode.outputs.myNodeOut },
    }),
    {
      edges: [
        { from: "input-0", to: "myNode-0", out: "myInput", in: "myNodeIn" },
        { from: "myNode-0", to: "output-0", out: "myNodeOut", in: "boardOut" },
      ],
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
                  title: "This is my title",
                  description: "This is my description",
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
    board({
      inputs: { boardInput1: myInput1 },
      outputs: { boardOut: myNode.outputs.myNodeOut },
    }),
    {
      edges: [
        {
          from: "input-0",
          to: "myNode-0",
          out: "boardInput1",
          in: "myNodeIn1",
        },
        {
          from: "myNode-0",
          to: "output-0",
          out: "myNodeOut",
          in: "boardOut",
        },
      ],
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
                      additionalProperties: false,
                    },
                  ],
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
                  additionalProperties: false,
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
    board({
      inputs: { boardNumInput: numInput },
      outputs: { boardStringArrayOut: boolToStringArray },
    }),
    {
      edges: [
        {
          from: "boolToStringArray-0",
          to: "output-0",
          out: "out",
          in: "boardStringArrayOut",
        },
        {
          from: "input-0",
          to: "numToString-0",
          out: "boardNumInput",
          in: "in",
        },
        { from: "numToString-0", to: "stringToBool-0", out: "out", in: "in" },
        {
          from: "stringToBool-0",
          to: "boolToStringArray-0",
          out: "out",
          in: "in",
        },
      ],
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
    }
  );
});

test("triangle", () => {
  const aDef = defineNodeType({
    name: "a",
    inputs: {},
    outputs: {
      aOut1: { type: "number" },
      aOut2: { type: "number" },
    },
    invoke: () => ({ aOut1: 123, aOut2: 123 }),
  });

  const bDef = defineNodeType({
    name: "b",
    inputs: {
      bIn: { type: "number" },
    },
    outputs: {
      bOut: { type: "number", primary: true },
    },
    invoke: () => ({ bOut: 123 }),
  });

  const a = aDef({});
  const b1 = bDef({ bIn: a.outputs.aOut2 });
  const b2 = bDef({ bIn: a.outputs.aOut1 });

  checkSerialization(
    board({
      inputs: {},
      outputs: { b1, b2 },
    }),
    {
      edges: [
        { from: "a-0", to: "b-0", out: "aOut2", in: "bIn" },
        { from: "a-0", to: "b-1", out: "aOut1", in: "bIn" },
        { from: "b-0", to: "output-0", out: "bOut", in: "b1" },
        { from: "b-1", to: "output-0", out: "bOut", in: "b2" },
      ],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                b1: { type: "number" },
                b2: { type: "number" },
              },
              required: ["b1", "b2"],
            },
          },
        },
        { id: "a-0", type: "a", configuration: {} },
        { id: "b-0", type: "b", configuration: {} },
        { id: "b-1", type: "b", configuration: {} },
      ],
    }
  );
});

test("polymorphic inputs", () => {
  const bInput = input({ type: "number" });
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {
      "*": {
        type: "number",
      },
    },
    outputs: {
      out: { type: "number" },
    },
    invoke: (_, values) => ({ out: Object.values(values)[0] ?? 0 }),
  })({ a: 1, b: bInput, c: 3 });
  checkSerialization(
    board({
      inputs: { bInput },
      outputs: { boardOut: myNode.outputs.out },
    }),
    {
      edges: [
        { from: "input-0", to: "myNode-0", out: "bInput", in: "b" },
        { from: "myNode-0", to: "output-0", out: "out", in: "boardOut" },
      ],
      nodes: [
        {
          id: "input-0",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                bInput: { type: "number" },
              },
              required: ["bInput"],
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
                boardOut: { type: "number" },
              },
              required: ["boardOut"],
            },
          },
        },
        {
          id: "myNode-0",
          type: "myNode",
          configuration: {
            a: 1,
            c: 3,
          },
        },
      ],
    }
  );
});

test("polymorphic outputs", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {},
    outputs: {
      "*": { type: "number" },
    },
    describe: () => ({ outputs: ["asserted"] }),
    invoke: (_, values) => ({
      out: Object.values(values)[0] ?? 0,
    }),
  })({});
  checkSerialization(
    board({
      inputs: {},
      outputs: {
        boardOut1: myNode.unsafeOutput("asserted1"),
        boardOut2: myNode.unsafeOutput("asserted2"),
        boardOut3: myNode.unsafeOutput("asserted1"),
      },
    }),
    {
      edges: [
        { from: "myNode-0", to: "output-0", out: "asserted1", in: "boardOut1" },
        { from: "myNode-0", to: "output-0", out: "asserted1", in: "boardOut3" },
        { from: "myNode-0", to: "output-0", out: "asserted2", in: "boardOut2" },
      ],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardOut1: { type: "number" },
                boardOut2: { type: "number" },
                boardOut3: { type: "number" },
              },
              required: ["boardOut1", "boardOut2", "boardOut3"],
            },
          },
        },
        { id: "myNode-0", type: "myNode", configuration: {} },
      ],
    }
  );
});

test("loopback", () => {
  const def = defineNodeType({
    name: "myNode",
    inputs: {
      foo: { type: "string" },
    },
    outputs: {
      bar: { type: "string" },
    },
    invoke: () => ({ bar: "abc" }),
  });

  const node1Bar = loopback();
  const nodeA = def({ foo: node1Bar });
  const nodeB = def({ foo: nodeA.outputs.bar });
  node1Bar.resolve(nodeB.outputs.bar);

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        outA: nodeA.outputs.bar,
        outB: nodeB.outputs.bar,
      },
    }),
    {
      edges: [
        { from: "myNode-0", to: "myNode-1", out: "bar", in: "foo" },
        { from: "myNode-0", to: "output-0", out: "bar", in: "outA" },
        { from: "myNode-1", to: "myNode-0", out: "bar", in: "foo" },
        { from: "myNode-1", to: "output-0", out: "bar", in: "outB" },
      ],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                outA: { type: "string" },
                outB: { type: "string" },
              },
              required: ["outA", "outB"],
            },
          },
        },
        { id: "myNode-0", type: "myNode", configuration: {} },
        { id: "myNode-1", type: "myNode", configuration: {} },
      ],
    }
  );
});

test("error: loopback not resolved", () => {
  const def = defineNodeType({
    name: "myNode",
    inputs: {
      foo: { type: "string" },
    },
    outputs: {
      bar: { type: "string" },
    },
    invoke: () => ({ bar: "abc" }),
  });

  const node1Bar = loopback();
  const nodeA = def({ foo: node1Bar });
  const nodeB = def({ foo: nodeA.outputs.bar });

  assert.throws(
    () =>
      serialize(
        board({
          inputs: {},
          outputs: {
            outA: nodeA.outputs.bar,
            outB: nodeB.outputs.bar,
          },
        })
      ),
    /Loopback was never resolved/
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
    () =>
      serialize(
        board({
          inputs: {},
          outputs: {
            boardOut: myNode.outputs.myNodeOut,
          },
        })
      ),
    /myNode-0:myNodeIn was wired to an input, but that input was not provided to the board inputs./
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
        board({
          inputs: { boardInput1: myInput, boardInput2: myOrphanInput },
          outputs: { boardOut: myNode.outputs.myNodeOut },
        })
      ),
    /Board input "boardInput2" is not reachable from any of its outputs./
  );
});

test("board title, description, and version", () => {
  const foo = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      foo: { type: "string", primary: true },
    },
    invoke: () => ({ foo: "foo" }),
  })({});
  checkSerialization(
    board({
      title: "Board Name",
      description: "Board Description",
      version: "1.2.3",
      inputs: {},
      outputs: { foo },
    }),
    {
      title: "Board Name",
      description: "Board Description",
      version: "1.2.3",
      edges: [{ from: "foo-0", to: "output-0", out: "foo", in: "foo" }],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: { foo: { type: "string" } },
              required: ["foo"],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});

test("icon", () => {
  const foo = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      foo: { type: "string", primary: true },
    },
    invoke: () => ({ foo: "foo" }),
  })({});
  checkSerialization(
    board({
      title: "Board Name",
      description: "Board Description",
      version: "1.2.3",
      metadata: {
        icon: "potato",
      },
      inputs: {},
      outputs: { foo },
    }),
    {
      title: "Board Name",
      description: "Board Description",
      version: "1.2.3",
      metadata: {
        icon: "potato",
      },
      edges: [{ from: "foo-0", to: "output-0", out: "foo", in: "foo" }],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: { foo: { type: "string" } },
              required: ["foo"],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});

test("node can have IDs", () => {
  const d1 = defineNodeType({
    name: "d1",
    inputs: {},
    outputs: {
      foo: { type: "string", primary: true },
    },
    invoke: () => ({ foo: "foo" }),
  });

  const d2 = defineNodeType({
    name: "d2",
    inputs: {
      bar: { type: "string" },
    },
    outputs: {
      baz: { type: "string", primary: true },
    },
    invoke: () => ({ baz: "baz" }),
  });

  const i1 = d1({ $id: "myCustomId1" });
  const i2 = d2({ $id: "myCustomId2", bar: i1 });
  const b = board({ inputs: {}, outputs: { i2 } });

  checkSerialization(b, {
    edges: [
      { from: "myCustomId1", to: "myCustomId2", out: "foo", in: "bar" },
      { from: "myCustomId2", to: "output-0", out: "baz", in: "i2" },
    ],
    nodes: [
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { i2: { type: "string" } },
            required: ["i2"],
          },
        },
      },
      { id: "myCustomId1", type: "d1", configuration: {} },
      { id: "myCustomId2", type: "d2", configuration: {} },
    ],
  });
});

test("node can have metadata", () => {
  const d1 = defineNodeType({
    name: "d1",
    inputs: {},
    outputs: {
      foo: { type: "string", primary: true },
    },
    invoke: () => ({ foo: "foo" }),
  });

  const d2 = defineNodeType({
    name: "d2",
    inputs: {
      bar: { type: "string" },
    },
    outputs: {
      baz: { type: "string", primary: true },
    },
    invoke: () => ({ baz: "baz" }),
  });

  const i1 = d1({
    $id: "myCustomId1",
    $metadata: {
      title: "my custom title 1",
      logLevel: "info",
    },
  });
  const i2 = d2({
    $id: "myCustomId2",
    bar: i1,
    $metadata: {
      title: "my custom title 2",
      description: "my custom description 2",
    },
  });
  const b = board({ inputs: {}, outputs: { i2 } });

  checkSerialization(b, {
    edges: [
      { from: "myCustomId1", to: "myCustomId2", out: "foo", in: "bar" },
      { from: "myCustomId2", to: "output-0", out: "baz", in: "i2" },
    ],
    nodes: [
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: { i2: { type: "string" } },
            required: ["i2"],
          },
        },
      },
      {
        id: "myCustomId1",
        type: "d1",
        configuration: {},
        metadata: {
          title: "my custom title 1",
          logLevel: "info",
        },
      },
      {
        id: "myCustomId2",
        type: "d2",
        configuration: {},
        metadata: {
          title: "my custom title 2",
          description: "my custom description 2",
        },
      },
    ],
  });
});

test("can't declare an input port called $metadata because it's reserved", () => {
  assert.throws(() => {
    const def = defineNodeType({
      name: "d1",
      inputs: {
        $metadata: {
          type: "string",
        },
      },
      outputs: {
        foo: { type: "string", primary: true },
      },
      invoke: () => ({ foo: "foo" }),
    });
    def({});
  }, /"\$metadata" cannot be used as an input port name because it is reserved/);
});

test("custom input id", () => {
  const passthru = defineNodeType({
    name: "passthru",
    inputs: {
      value: { type: "string" },
    },
    outputs: {
      value: { type: "string", primary: true },
    },
    invoke: ({ value }) => ({ value }),
  });

  const in1 = input({ $id: "custom-input" });

  checkSerialization(
    board({
      inputs: {
        in1,
      },
      outputs: {
        result: passthru({ value: in1 }),
      },
    }),
    {
      edges: [
        { from: "custom-input", to: "passthru-0", out: "in1", in: "value" },
        { from: "passthru-0", to: "output-0", out: "value", in: "result" },
      ],
      nodes: [
        {
          id: "custom-input",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: { in1: { type: "string" } },
              required: ["in1"],
            },
          },
        },
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: { result: { type: "string" } },
              required: ["result"],
            },
          },
        },
        { id: "passthru-0", type: "passthru", configuration: {} },
      ],
    }
  );
});

test("two different custom input ids", () => {
  const passthru = defineNodeType({
    name: "passthru",
    inputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    outputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    invoke: ({ value1, value2 }) => ({ value1, value2 }),
  });

  const in1 = input({ $id: "custom-input-1" });
  const in2 = input({ $id: "custom-input-2" });
  const pt = passthru({ value1: in1, value2: in2 });

  checkSerialization(
    board({
      inputs: {
        in1,
        in2,
      },
      outputs: {
        result1: pt.outputs.value1,
        result2: pt.outputs.value2,
      },
    }),
    {
      edges: [
        { from: "custom-input-1", to: "passthru-0", out: "in1", in: "value1" },
        { from: "custom-input-2", to: "passthru-0", out: "in2", in: "value2" },
        { from: "passthru-0", to: "output-0", out: "value1", in: "result1" },
        { from: "passthru-0", to: "output-0", out: "value2", in: "result2" },
      ],
      nodes: [
        {
          id: "custom-input-1",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                in1: { type: "string" },
              },
              required: ["in1"],
            },
          },
        },
        {
          id: "custom-input-2",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                in2: { type: "string" },
              },
              required: ["in2"],
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
                result1: { type: "string" },
                result2: { type: "string" },
              },
              required: ["result1", "result2"],
            },
          },
        },
        { id: "passthru-0", type: "passthru", configuration: {} },
      ],
    }
  );
});

test("two same custom input ids", () => {
  const passthru = defineNodeType({
    name: "passthru",
    inputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    outputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    invoke: ({ value1, value2 }) => ({ value1, value2 }),
  });

  const in1 = input({ $id: "custom-input" });
  const in2 = input({ $id: "custom-input" });
  const pt = passthru({ value1: in1, value2: in2 });

  checkSerialization(
    board({
      inputs: {
        in1,
        in2,
      },
      outputs: {
        result1: pt.outputs.value1,
        result2: pt.outputs.value2,
      },
    }),
    {
      edges: [
        { from: "custom-input", to: "passthru-0", out: "in1", in: "value1" },
        { from: "custom-input", to: "passthru-0", out: "in2", in: "value2" },
        { from: "passthru-0", to: "output-0", out: "value1", in: "result1" },
        { from: "passthru-0", to: "output-0", out: "value2", in: "result2" },
      ],
      nodes: [
        {
          id: "custom-input",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                in1: { type: "string" },
                in2: { type: "string" },
              },
              required: ["in1", "in2"],
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
                result1: { type: "string" },
                result2: { type: "string" },
              },
              required: ["result1", "result2"],
            },
          },
        },
        { id: "passthru-0", type: "passthru", configuration: {} },
      ],
    }
  );
});

test("custom and default input id", () => {
  const passthru = defineNodeType({
    name: "passthru",
    inputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    outputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    invoke: ({ value1, value2 }) => ({ value1, value2 }),
  });

  const in1 = input({ $id: "custom-input" });
  const in2 = input({});
  const pt = passthru({ value1: in1, value2: in2 });

  checkSerialization(
    board({
      inputs: {
        in1,
        in2,
      },
      outputs: {
        result1: pt.outputs.value1,
        result2: pt.outputs.value2,
      },
    }),
    {
      edges: [
        { from: "custom-input", to: "passthru-0", out: "in1", in: "value1" },
        { from: "input-0", to: "passthru-0", out: "in2", in: "value2" },
        { from: "passthru-0", to: "output-0", out: "value1", in: "result1" },
        { from: "passthru-0", to: "output-0", out: "value2", in: "result2" },
      ],
      nodes: [
        {
          id: "custom-input",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                in1: { type: "string" },
              },
              required: ["in1"],
            },
          },
        },
        {
          id: "input-0",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                in2: { type: "string" },
              },
              required: ["in2"],
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
                result1: { type: "string" },
                result2: { type: "string" },
              },
              required: ["result1", "result2"],
            },
          },
        },
        { id: "passthru-0", type: "passthru", configuration: {} },
      ],
    }
  );
});

test("custom output id", () => {
  const def = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      value: { type: "string", primary: true },
    },
    invoke: () => ({ value: "foo" }),
  });

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        result: output(def({}), { id: "custom-output" }),
      },
    }),
    {
      edges: [
        { from: "foo-0", to: "custom-output", out: "value", in: "result" },
      ],
      nodes: [
        {
          id: "custom-output",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: { result: { type: "string" } },
              required: ["result"],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});

test("two different custom output ids", () => {
  const def = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    invoke: () => ({ value1: "foo", value2: "foo" }),
  });

  const foo = def({});

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        result1: output(foo.outputs.value1, { id: "custom-input-1" }),
        result2: output(foo.outputs.value2, { id: "custom-input-2" }),
      },
    }),
    {
      edges: [
        { from: "foo-0", to: "custom-input-1", out: "value1", in: "result1" },
        { from: "foo-0", to: "custom-input-2", out: "value2", in: "result2" },
      ],
      nodes: [
        {
          id: "custom-input-1",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                result1: { type: "string" },
              },
              required: ["result1"],
            },
          },
        },
        {
          id: "custom-input-2",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                result2: { type: "string" },
              },
              required: ["result2"],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});

test("two same custom output ids", () => {
  const def = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    invoke: () => ({ value1: "foo", value2: "foo" }),
  });

  const foo = def({});

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        result1: output(foo.outputs.value1, { id: "custom-output" }),
        result2: output(foo.outputs.value2, { id: "custom-output" }),
      },
    }),
    {
      edges: [
        { from: "foo-0", to: "custom-output", out: "value1", in: "result1" },
        { from: "foo-0", to: "custom-output", out: "value2", in: "result2" },
      ],
      nodes: [
        {
          id: "custom-output",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                result1: { type: "string" },
                result2: { type: "string" },
              },
              required: ["result1", "result2"],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});

test("custom and default output ids", () => {
  const def = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      value1: { type: "string" },
      value2: { type: "string" },
    },
    invoke: () => ({ value1: "foo", value2: "foo" }),
  });

  const foo = def({});

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        result1: foo.outputs.value1,
        result2: output(foo.outputs.value2, { id: "custom-output" }),
      },
    }),
    {
      edges: [
        { from: "foo-0", to: "custom-output", out: "value2", in: "result2" },
        { from: "foo-0", to: "output-0", out: "value1", in: "result1" },
      ],
      nodes: [
        {
          id: "custom-output",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                result2: { type: "string" },
              },
              required: ["result2"],
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
                result1: { type: "string" },
              },
              required: ["result1"],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});

test("output with title and description", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {},
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({});
  checkSerialization(
    board({
      inputs: {},
      outputs: {
        boardOut: output(myNode.outputs.myNodeOut, {
          id: "custom-output",
          title: "Custom Title",
          description: "Custom Description",
        }),
      },
    }),
    {
      edges: [
        {
          from: "myNode-0",
          to: "custom-output",
          out: "myNodeOut",
          in: "boardOut",
        },
      ],
      nodes: [
        {
          id: "custom-output",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardOut: {
                  type: "string",
                  title: "Custom Title",
                  description: "Custom Description",
                },
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
    }
  );
});

test("unsafe cast as output", () => {
  const myNode = defineNodeType({
    name: "myNode",
    inputs: {},
    outputs: {
      myNodeOut: { type: "string" },
    },
    invoke: () => ({ myNodeOut: "aaa" }),
  })({});
  checkSerialization(
    board({
      inputs: {},
      outputs: {
        boardOut: output(unsafeCast(myNode.outputs.myNodeOut, "number"), {
          id: "custom-output",
          title: "Custom Title",
          description: "Custom Description",
        }),
      },
    }),
    {
      edges: [
        {
          from: "myNode-0",
          to: "custom-output",
          out: "myNodeOut",
          in: "boardOut",
        },
      ],
      nodes: [
        {
          id: "custom-output",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                boardOut: {
                  type: "number",
                  title: "Custom Title",
                  description: "Custom Description",
                },
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
    }
  );
});

test("unsafe cast as input to another node", () => {
  const makesStringDef = defineNodeType({
    name: "makesString",
    inputs: {},
    outputs: {
      str: { type: "string", primary: true },
    },
    invoke: () => ({ str: "foo" }),
  });

  const takesNumberDef = defineNodeType({
    name: "takesNumber",
    inputs: {
      num: { type: "number" },
    },
    outputs: {
      num: { type: "number", primary: true },
    },
    invoke: ({ num }) => ({ num }),
  });

  takesNumberDef({
    // @ts-expect-error
    num: makesStringDef({}),
  });

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        strAsNum: takesNumberDef({
          num: unsafeCast(makesStringDef({}), "number"),
        }),
      },
    }),
    {
      edges: [
        { from: "makesString-0", to: "takesNumber-0", out: "str", in: "num" },
        { from: "takesNumber-0", to: "output-0", out: "num", in: "strAsNum" },
      ],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                strAsNum: { type: "number" },
              },
              required: ["strAsNum"],
            },
          },
        },
        { id: "makesString-0", type: "makesString", configuration: {} },
        { id: "takesNumber-0", type: "takesNumber", configuration: {} },
      ],
    }
  );
});

test("constant", () => {
  const a = defineNodeType({
    name: "a",
    inputs: {},
    outputs: {
      ao1: { type: "string", primary: true },
      ao2: { type: "number" },
      ao3: { type: "boolean" },
    },
    invoke: () => ({ ao1: "foo", ao2: 123, ao3: true }),
  });

  const b = defineNodeType({
    name: "b",
    inputs: {
      bi1c: { type: "string" },
      bi2: { type: "number" },
      bi3c: { type: "boolean" },
    },
    outputs: {
      bo1: { type: "string", primary: true },
      bo2: { type: "number" },
      bo3: { type: "boolean" },
    },
    invoke: () => ({ bo1: "foo", bo2: 123, bo3: true }),
  });

  const { ao1, ao2, ao3 } = a({}).outputs;
  const { bo1, bo2 } = b({
    bi1c: constant(ao1),
    bi2: ao2,
    bi3c: constant(ao3),
  }).outputs;

  checkSerialization(
    board({
      inputs: {},
      outputs: {
        ao1,
        ao2c: constant(ao2),
        bo1,
        bo2c: constant(bo2),
      },
    }),
    {
      edges: [
        { from: "a-0", to: "b-0", out: "ao1", in: "bi1c", constant: true },
        { from: "a-0", to: "b-0", out: "ao2", in: "bi2" },
        { from: "a-0", to: "b-0", out: "ao3", in: "bi3c", constant: true },
        { from: "a-0", to: "output-0", out: "ao1", in: "ao1" },
        { from: "a-0", to: "output-0", out: "ao2", in: "ao2c", constant: true },
        { from: "b-0", to: "output-0", out: "bo1", in: "bo1" },
        { from: "b-0", to: "output-0", out: "bo2", in: "bo2c", constant: true },
      ],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                ao1: { type: "string" },
                ao2c: { type: "number" },
                bo1: { type: "string" },
                bo2c: { type: "number" },
              },
              required: ["ao1", "ao2c", "bo1", "bo2c"],
            },
          },
        },
        { id: "a-0", type: "a", configuration: {} },
        { id: "b-0", type: "b", configuration: {} },
      ],
    }
  );
});

test("constant input", () => {
  const stringInput = input();
  const inputWithDefault = input({ default: 123 });

  const a = defineNodeType({
    name: "a",
    inputs: {
      ai1: { type: "string" },
      ai2: { type: "number" },
    },
    outputs: {
      ao1: { type: "string" },
    },
    invoke: () => ({ ao1: "foo" }),
  });

  const { ao1 } = a({
    ai1: constant(stringInput),
    ai2: constant(inputWithDefault),
  }).outputs;

  checkSerialization(
    board({
      inputs: {
        stringInput,
        inputWithDefault,
      },
      outputs: {
        ao1,
      },
    }),
    {
      edges: [
        {
          from: "a-0",
          to: "output-0",
          out: "ao1",
          in: "ao1",
        },
        {
          from: "input-0",
          to: "a-0",
          out: "inputWithDefault",
          in: "ai2",
          constant: true,
        },
        {
          from: "input-0",
          to: "a-0",
          out: "stringInput",
          in: "ai1",
          constant: true,
        },
      ],
      nodes: [
        {
          id: "input-0",
          type: "input",
          configuration: {
            schema: {
              type: "object",
              properties: {
                inputWithDefault: { type: "number", default: "123" },
                stringInput: { type: "string" },
              },
              required: ["stringInput"],
            },
          },
        },
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: { ao1: { type: "string" } },
              required: ["ao1"],
            },
          },
        },
        { id: "a-0", type: "a", configuration: {} },
      ],
    }
  );
});

test("optional output", () => {
  const foo = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      nodeOut: { type: "string" },
    },
    invoke: () => ({ nodeOut: "foo" }),
  });

  const { nodeOut } = foo({}).outputs;

  checkSerialization(
    board({
      inputs: {},
      outputs: { boardOut: output(optionalEdge(nodeOut)) },
    }),
    {
      edges: [
        {
          from: "foo-0",
          to: "output-0",
          out: "nodeOut",
          in: "boardOut",
          optional: true,
        },
      ],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: { boardOut: { type: "string" } },
              required: [],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});

test("$error can be wired to $error", () => {
  const foo = defineNodeType({
    name: "foo",
    inputs: {},
    outputs: {
      foo: { type: "string" },
    },
    invoke: () => ({ foo: "foo" }),
  })({});

  checkSerialization(
    board({
      inputs: {},
      outputs: [outputNode({ $error: output(foo.outputs.$error) })],
    }),
    {
      edges: [{ from: "foo-0", to: "output-0", out: "$error", in: "$error" }],
      nodes: [
        {
          id: "output-0",
          type: "output",
          configuration: {
            schema: {
              type: "object",
              properties: {
                $error: {
                  type: "object",
                  anyOf: [
                    {
                      type: "object",
                      properties: { message: { type: "string" } },
                      required: ["message"],
                      additionalProperties: false,
                    },
                    {
                      type: "object",
                      properties: {
                        kind: { type: "string" },
                        error: {
                          type: "object",
                          properties: { message: { type: "string" } },
                          required: ["message"],
                          additionalProperties: false,
                        },
                      },
                      required: ["kind", "error"],
                      additionalProperties: false,
                    },
                  ],
                },
              },
              required: ["$error"],
            },
          },
        },
        { id: "foo-0", type: "foo", configuration: {} },
      ],
    }
  );
});
