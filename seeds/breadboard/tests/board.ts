/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Board } from "../src/board.js";
import type {
  ProbeEvent,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
  BreadboardCapability,
} from "../src/types.js";
import { NodeHandlers } from "@google-labs/graph-runner";

test("correctly skips nodes when asked", async (t) => {
  const board = new Board();
  board
    .input()
    .wire(
      "*->",
      board.passthrough({ $id: "toSkip" }).wire("*->", board.output())
    );

  const skipper = new EventTarget();
  skipper.addEventListener("beforehandler", (event) => {
    const e = event as ProbeEvent;
    if (e.detail.descriptor.id === "toSkip") {
      e.detail.outputs = { instead: "this" };
      e.preventDefault();
    }
  });

  const result = await board.runOnce({ hello: "world" }, undefined, skipper);
  t.deepEqual(result, { instead: "this" });
});

test("correctly passes inputs and outputs to included boards", async (t) => {
  const nestedBoard = new Board();
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedBoard
        .passthrough()
        .wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  board
    .input()
    .wire(
      "hello->",
      board.include(nestedBoard).wire("hello->", board.output())
    );

  const result = await board.runOnce({ hello: "world" });
  t.deepEqual(result, { hello: "world" });
});

test("correctly passes inputs and outputs to invoked boards", async (t) => {
  const nestedBoard = new Board();
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedBoard
        .passthrough()
        .wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  board
    .input()
    .wire("hello->", board.invoke(nestedBoard).wire("hello->", board.output()));

  const result = await board.runOnce({ hello: "world" });
  t.deepEqual(result, { hello: "world" });
});

test("correctly passes inputs and outputs to included boards with a probe", async (t) => {
  const nestedBoard = new Board();
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedBoard
        .passthrough()
        .wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  board
    .input()
    .wire(
      "hello->",
      board.include(nestedBoard).wire("hello->", board.output())
    );

  const result = await board.runOnce({ hello: "world" });
  t.deepEqual(result, { hello: "world" });
});

test("correctly skips nodes in nested boards", async (t) => {
  const nestedBoard = new Board();
  nestedBoard
    .input()
    .wire(
      "*->",
      nestedBoard
        .passthrough({ $id: "toSkip" })
        .wire("*->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  board
    .input()
    .wire("*->", board.include(nestedBoard).wire("*->", board.output()));

  const skipper = new EventTarget();
  skipper.addEventListener("beforehandler", (event) => {
    const e = event as ProbeEvent;
    if (e.detail.descriptor.id === "toSkip") {
      e.detail.outputs = { instead: "this" };
      e.preventDefault();
    }
  });

  const result = await board.runOnce({ hello: "world" }, undefined, skipper);
  t.deepEqual(result, { instead: "this" });
});

test("allows pausing and resuming the board", async (t) => {
  let result;
  const board = new Board();
  const input = board.input();
  input.wire("<-", board.passthrough());
  input.wire(
    "*->",
    board.passthrough().wire("*->", board.output().wire("*->", input))
  );
  {
    const firstBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of firstBoard.run()) {
      t.is(stop.type, "beforehandler");
      result = stop;
      break;
    }
  }
  {
    const secondBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of secondBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
  {
    const thirdBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of thirdBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "beforehandler");
      result = stop;
      break;
    }
  }
  {
    const fourthBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of fourthBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "output");
      result = stop;
      break;
    }
  }
  {
    const fifthBoard = await Board.fromGraphDescriptor(board);
    for await (const stop of fifthBoard.run(undefined, undefined, result)) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
});

class TestKit implements Kit {
  url = "none";
  #nodeFactory: NodeFactory;

  get handlers() {
    return {} as NodeHandlers;
  }

  constructor(nodeFactory: NodeFactory) {
    this.#nodeFactory = nodeFactory;
  }

  test(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create(this, "test", rest, $id);
  }
}

test("lambda node from function with correctly assigned nodes", async (t) => {
  const board = new Board();

  const kit = board.addKit(TestKit);
  kit.url = "test";

  board.lambda((board, input, output) => {
    input.wire("*->", kit.test().wire("*->", output));
  });

  t.deepEqual(JSON.parse(JSON.stringify(board.nodes)), [
    {
      configuration: {
        board: {
          kind: "board",
          board: {
            edges: [
              { from: "test-3", out: "*", to: "output-2" },
              {
                from: "input-1",
                out: "*",
                to: "test-3",
              },
            ],
            nodes: [
              { id: "input-1", type: "input" },
              { id: "output-2", type: "output" },
              { id: "test-3", type: "test" },
            ],
            kits: [{ url: "test" }],
          },
        },
      },
      id: "lambda-1",
      type: "lambda",
    },
  ]);
});

test("nested lambdas reusing kits", async (t) => {
  const board = new Board();

  const kits = [];

  const kit = board.addKit(TestKit);
  kit.url = "test";
  kits.push(kit);

  board.lambda((board, input, output) => {
    const kit2 = board.addKit(TestKit);
    kit2.url = "test2";
    kits.push(kit2);

    input.wire(
      "*->",
      kit2.test().wire(
        "*->",
        board
          .lambda((board, input, output) => {
            input.wire(
              "*->",
              kit.test().wire("*->", kit2.test().wire("*->", output))
            );
          })
          .wire("*->", output)
      )
    );
  });

  // kit2 was defined in the closure, so shouldn't be on the main board
  t.deepEqual(board.kits, [kit]);

  // kit1 wasn't used in the first lambda, so shouldn't be on the lambda board
  const lambda1 = board.nodes.find((n) => n.type === "lambda");
  const board2 = (
    lambda1?.configuration?.board as BreadboardCapability | undefined
  )?.board;
  t.deepEqual(board2?.kits, [kits[1]]);

  // both kits were used in the second lambda
  const lambda2 = board2?.nodes.find((n) => n.type === "lambda");
  const board3 = (
    lambda2?.configuration?.board as BreadboardCapability | undefined
  )?.board;
  t.deepEqual(board3?.kits, kits);
});

test("corectly invoke a lambda", async (t) => {
  const board = new Board();

  board.input().wire(
    "*->",
    board
      .invoke((board, input, output) => {
        input.wire("*->", board.passthrough().wire("*->", output));
      })
      .wire("*->", board.output())
  );

  const result = await board.runOnce({ foo: "bar" });
  t.deepEqual(result, { foo: "bar" });
});

test("throws when incorrectly wiring different boards", async (t) => {
  const board = new Board();
  const board2 = new Board();
  const input = board.input();
  const output = board2.output();
  await t.throwsAsync(
    async () => {
      input.wire("foo->.", output);
    },
    { message: "Across board wires: From must be parent of to" }
  );
  await t.throwsAsync(
    async () => {
      input.wire("foo<-", output);
    },
    { message: "Across board wires: Must be constant for now" }
  );
});

test("allow wiring across boards with lambdas", async (t) => {
  const board = new Board();
  const passthrough = board.passthrough({ foo: 1 });
  const lambda = board.lambda((board, input, output) => {
    board
      .passthrough()
      .wire("foo<-.", passthrough)
      .wire("bar<-.", input)
      .wire("*->.", output);
  });
  board
    .input()
    .wire(
      "bar->",
      board.invoke().wire("board<-", lambda).wire("*->", board.output())
    );
  const output = await board.runOnce({ bar: 2 });
  t.deepEqual(output, { bar: 2, foo: 1 });
});
