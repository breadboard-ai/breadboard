/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { parseSpec, Node } from "../src/node.js";
import { Board } from "../src/board.js";

test("parseSpec: control-only", (t) => {
  t.deepEqual(parseSpec(""), { ltr: true, edge: {} });
  t.deepEqual(parseSpec("->"), { ltr: true, edge: {} });
  t.deepEqual(parseSpec("<-"), { ltr: false, edge: {} });
});

test("parseSpec: all-value", (t) => {
  t.deepEqual(parseSpec("*"), { ltr: true, edge: { out: "*" } });
  t.deepEqual(parseSpec("*->"), { ltr: true, edge: { out: "*" } });
  t.deepEqual(parseSpec("->*"), { ltr: true, edge: { out: "*" } });
  t.deepEqual(parseSpec("<-*"), { ltr: false, edge: { out: "*" } });
  t.deepEqual(parseSpec("*<-"), { ltr: false, edge: { out: "*" } });
});

test("parseSpec: simple", (t) => {
  t.deepEqual(parseSpec("a"), { ltr: true, edge: { out: "a", in: "a" } });
  t.deepEqual(parseSpec("->a"), { ltr: true, edge: { out: "a", in: "a" } });
  t.deepEqual(parseSpec("a->"), { ltr: true, edge: { out: "a", in: "a" } });
  t.deepEqual(parseSpec("<-a"), { ltr: false, edge: { out: "a", in: "a" } });
  t.deepEqual(parseSpec("a<-"), { ltr: false, edge: { out: "a", in: "a" } });
});

test("parseSpec: simple with optional", (t) => {
  t.deepEqual(parseSpec("a?"), {
    ltr: true,
    edge: { out: "a", in: "a", optional: true },
  });
  t.deepEqual(parseSpec("->a?"), {
    ltr: true,
    edge: { out: "a", in: "a", optional: true },
  });
  t.deepEqual(parseSpec("a->?"), {
    ltr: true,
    edge: { out: "a", in: "a", optional: true },
  });
  t.deepEqual(parseSpec("<-a?"), {
    ltr: false,
    edge: { out: "a", in: "a", optional: true },
  });
  t.deepEqual(parseSpec("a<-?"), {
    ltr: false,
    edge: { out: "a", in: "a", optional: true },
  });
});

test("parseSpec: simple with constant", (t) => {
  t.deepEqual(parseSpec("a."), {
    ltr: true,
    edge: { out: "a", in: "a", constant: true },
  });
  t.deepEqual(parseSpec("->a."), {
    ltr: true,
    edge: { out: "a", in: "a", constant: true },
  });
  t.deepEqual(parseSpec("a->."), {
    ltr: true,
    edge: { out: "a", in: "a", constant: true },
  });
  t.deepEqual(parseSpec("<-a."), {
    ltr: false,
    edge: { out: "a", in: "a", constant: true },
  });
  t.deepEqual(parseSpec("a<-."), {
    ltr: false,
    edge: { out: "a", in: "a", constant: true },
  });
});

test("parseSpec: simple with optional and constant (invalid spec)", (t) => {
  t.throws(() => parseSpec("a?."));
  t.throws(() => parseSpec("a.?"));
});

test("parseSpec: both in and out specified", (t) => {
  t.deepEqual(parseSpec("a->b"), { ltr: true, edge: { out: "a", in: "b" } });
  t.deepEqual(parseSpec("a<-b"), { ltr: false, edge: { out: "b", in: "a" } });
});

test("parseSpec: both in and out specified with optional", (t) => {
  t.deepEqual(parseSpec("a->b?"), {
    ltr: true,
    edge: { out: "a", in: "b", optional: true },
  });
  t.deepEqual(parseSpec("a<-b?"), {
    ltr: false,
    edge: { out: "b", in: "a", optional: true },
  });
});

test("parseSpec: both in and out specified with constant", (t) => {
  t.deepEqual(parseSpec("a->b."), {
    ltr: true,
    edge: { out: "a", in: "b", constant: true },
  });
  t.deepEqual(parseSpec("a<-b."), {
    ltr: false,
    edge: { out: "b", in: "a", constant: true },
  });
});

test("throws when wiring different boards", async (t) => {
  const board = new Board();
  const board2 = new Board();
  const input = board.input();
  const output = board2.output();
  await t.throwsAsync(
    async () => {
      input.wire("*->", output);
    },
    { message: "Cannot wire nodes from different boards." }
  );
});

test("convert nodes in config to wires", async (t) => {
  const board = new Board();
  const input = board.input();
  new Node(board, "test", { foo: input, "bar<-baz": input, baz: 1 });
  t.deepEqual(board.nodes, [
    { id: "input-1", type: "input" },
    { id: "test-2", type: "test", configuration: { baz: 1 } },
  ]);
  t.deepEqual(board.edges, [
    { constant: true, from: "input-1", to: "test-2", in: "foo", out: "foo" },
    { from: "input-1", to: "test-2", in: "bar", out: "baz" },
  ]);
});
