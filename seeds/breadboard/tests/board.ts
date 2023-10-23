/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Board } from "../src/board.js";
import type {
  ProbeEvent,
  BreadboardCapability,
  GraphDescriptor,
} from "../src/types.js";
import { TestKit } from "./helpers/_test-kit.js";

test("correctly skips nodes when asked", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire("*->", kit.noop({ $id: "toSkip" }).wire("*->", board.output()));

  const skipper = new EventTarget();
  skipper.addEventListener("beforehandler", (event) => {
    const e = event as ProbeEvent;
    if (e.detail.descriptor.id === "toSkip") {
      e.detail.outputs = { instead: "this" };
      e.preventDefault();
    }
  });

  const result = await board.runOnce({ hello: "world" }, { probe: skipper });
  t.deepEqual(result, { instead: "this" });
});

test("correctly passes inputs and outputs to included boards", async (t) => {
  const nestedBoard = new Board();
  const nestedKit = nestedBoard.addKit(TestKit);
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedKit.noop().wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire(
      "hello->",
      kit
        .include({ graph: nestedBoard as GraphDescriptor })
        .wire("hello->", board.output())
    );

  const result = await board.runOnce({ hello: "world" }, { kits: [nestedKit] });
  t.deepEqual(result, { hello: "world" });
});

test("correctly passes inputs and outputs to invoked boards", async (t) => {
  const nestedBoard = new Board();
  const nestedKit = nestedBoard.addKit(TestKit);
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedKit.noop().wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire("hello->", kit.invoke(nestedBoard).wire("hello->", board.output()));

  const result = await board.runOnce({ hello: "world" }, { kits: [nestedKit] });
  t.deepEqual(result, { hello: "world" });
});

test("correctly passes inputs and outputs to included boards with a probe", async (t) => {
  const nestedBoard = new Board();
  const nestedKit = nestedBoard.addKit(TestKit);
  nestedBoard
    .input()
    .wire(
      "hello->",
      nestedKit.noop().wire("hello->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire(
      "hello->",
      kit
        .include({ graph: nestedBoard as GraphDescriptor })
        .wire("hello->", board.output())
    );

  const result = await board.runOnce({ hello: "world" }, { kits: [nestedKit] });
  t.deepEqual(result, { hello: "world" });
});

test("correctly skips nodes in nested boards", async (t) => {
  const nestedBoard = new Board();
  const nestedKit = nestedBoard.addKit(TestKit);
  nestedBoard
    .input()
    .wire(
      "*->",
      nestedKit
        .noop({ $id: "toSkip" })
        .wire("*->", nestedBoard.output({ $id: "output" }))
    );

  const board = new Board();
  const kit = board.addKit(TestKit);
  board
    .input()
    .wire(
      "*->",
      kit
        .include({ graph: nestedBoard as GraphDescriptor })
        .wire("*->", board.output())
    );

  const skipper = new EventTarget();
  skipper.addEventListener("beforehandler", (event) => {
    const e = event as ProbeEvent;
    if (e.detail.descriptor.id === "toSkip") {
      e.detail.outputs = { instead: "this" };
      e.preventDefault();
    }
  });

  const result = await board.runOnce(
    { hello: "world" },
    { probe: skipper, kits: [nestedKit] }
  );
  t.deepEqual(result, { instead: "this" });
});

test("allows pausing and resuming the board", async (t) => {
  let result;
  const board = new Board();
  const kit = board.addKit(TestKit);
  const input = board.input();
  input.wire("<-", kit.noop());
  input.wire("*->", kit.noop().wire("*->", board.output().wire("*->", input)));
  {
    const firstBoard = await Board.fromGraphDescriptor(board, {
      "test-kit": TestKit,
    });
    for await (const stop of firstBoard.run({ kits: [kit] })) {
      t.is(stop.type, "beforehandler");
      result = stop;
      break;
    }
  }
  {
    const secondBoard = await Board.fromGraphDescriptor(board, {
      "test-kit": TestKit,
    });
    for await (const stop of secondBoard.run({ kits: [kit] }, result)) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
  {
    const thirdBoard = await Board.fromGraphDescriptor(board, {
      "test-kit": TestKit,
    });
    for await (const stop of thirdBoard.run({ kits: [kit] }, result)) {
      t.is(stop.type, "beforehandler");
      result = stop;
      break;
    }
  }
  {
    const fourthBoard = await Board.fromGraphDescriptor(board, {
      "test-kit": TestKit,
    });
    for await (const stop of fourthBoard.run({ kits: [kit] }, result)) {
      t.is(stop.type, "output");
      result = stop;
      break;
    }
  }
  {
    const fifthBoard = await Board.fromGraphDescriptor(board, {
      "test-kit": TestKit,
    });
    for await (const stop of fifthBoard.run({ kits: [kit] }, result)) {
      t.is(stop.type, "input");
      result = stop;
      break;
    }
  }
});

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
  const kit = board.addKit(TestKit);

  board.input().wire(
    "*->",
    kit
      .invoke((board, input, output) => {
        const kit = board.addKit(TestKit);
        input.wire("*->", kit.noop().wire("*->", output));
      })
      .wire("*->", board.output())
  );

  const result = await board.runOnce({ foo: "bar" }, { kits: [kit] });
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
  const kit = board.addKit(TestKit);
  const noop = kit.noop({ foo: 1 });
  const lambda = board.lambda((board, input, output) => {
    const kit = board.addKit(TestKit);
    kit.noop().wire("foo<-.", noop).wire("bar<-.", input).wire("*->.", output);
  });
  board
    .input()
    .wire(
      "bar->",
      kit.invoke().wire("board<-", lambda).wire("*->", board.output())
    );
  const output = await board.runOnce({ bar: 2 }, { kits: [kit] });
  t.deepEqual(output, { bar: 2, foo: 1 });
});

test("when $error is set, all other outputs are ignored, named", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  const noop = kit.noop({ foo: 1, $error: { kind: "error" } });
  noop.wire("foo->", board.output());
  noop.wire(
    "$error->",
    // extra noop so that the above output would be used first
    kit.noop().wire("$error->", board.output())
  );
  const result = await board.runOnce({});
  t.is(result.foo, undefined);
  t.like(result.$error, { kind: "error" });
});

test("when $error is set, all other outputs are ignored, with *", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  const noop = kit.noop({ foo: 1, $error: { kind: "error" } });
  const output = board.output();
  noop.wire("*->", output);
  noop.wire("$error->", output);
  const result = await board.runOnce({});
  t.is(result.foo, undefined);
  t.like(result.$error, { kind: "error" });
});
