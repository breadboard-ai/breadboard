import assert from "node:assert";
import { describe, test } from "node:test";
import { Board } from "../src/board.js";

test("some test", (t) => {
  assert.equal(1 + 1, 2);
});

describe("can create a board", (t) => {
  const board: Board = new Board();

  test("board is defined", () => {
    assert.ok(board);
  });

  test("board is an object", () => {
    assert.equal(typeof board, "object");
  });

  test("board has a nodes array", () => {
    assert.ok(board.nodes);
  });

  test("board has a nodes property", () => {
    assert.ok(board.nodes);
  });

  test("board has a nodes property that is an array", () => {
    assert.ok(Array.isArray(board.nodes));
  });

  test("board has a nodes property that is an array of length 0", () => {
    assert.equal(board.nodes.length, 0);
  });

  test("board has a edges property", () => {
    assert.ok(board.edges);
  });

  test("board has a edges property that is an array", () => {
    assert.ok(Array.isArray(board.edges));
  });

  test("board has a edges property that is an array of length 0", () => {
    assert.equal(board.edges.length, 0);
  });


  test("board has a kits property", () => {
    assert.ok(board.kits);
  });

  test("board has a kits property that is an array", () => {
    assert.ok(Array.isArray(board.kits));
  });

  test("board has a kits property that is an array of length 0", () => {
    assert.equal(board.kits.length, 0);
  });
});

test("board is created with correct title", (t) => {
  const title = "My Board";
  const board: Board = new Board({
    title,
  });
  assert.equal(board.title, title);
})

