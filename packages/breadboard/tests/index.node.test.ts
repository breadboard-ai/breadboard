// export default Ajv;
import { Schema, SchemaDraft, ValidationResult, Validator } from "@cfworker/json-schema";
import breadboardSchema from "@google-labs/breadboard-schema/breadboard.schema.json" assert { type: "json" };
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
});

const shortCircuit = false;
const draft: SchemaDraft = "2020-12";
const breadboardValidator = new Validator(breadboardSchema as Schema, draft, shortCircuit);

describe("schema tests", async (t) => {
  await test("board has something that looks like a schema", async (t) => {
    const board = new Board();
    const schema: string = board.$schema!;

    await t.test("schema is defined", (t) => {
      assert.ok(schema);
    });

    await t.test("schema is a valid uri", (t) => {
      assert.match(schema, /^https?:\/\/.*/);
    });
    await t.test("schema can be resolved", (t) => {
      assert.doesNotThrow(() => new URL(schema));
    });
    // assert that url can be fetched
    await t.test("schema can be fetched", (t) => {
      assert.doesNotThrow(() => fetch(schema));
    });
  });

  await test("validator that the validator validates", async (t) => {
    const board = new Board();
    const boardJson = JSON.parse(JSON.stringify(board));
    const result: ValidationResult = breadboardValidator.validate(boardJson);
    assert.ok(result.valid);
    assert.ok(result.errors.length === 0);
  });
});
