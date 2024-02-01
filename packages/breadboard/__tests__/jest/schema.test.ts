import breadboardSchema from "@google-labs/breadboard-schema/breadboard.schema.json" assert { type: "json" };
import { Board } from "../../src/board.js";

describe("jest is jesting", () => {
  test("jest is jesting", () => {
    expect(1 + 1).toBe(2);
  });
});

describe("breadboard schema", () => {
  test("can create a board", () => {
    const board = new Board();
    expect(board).toBeDefined();
  });
});

describe("test schema usage", () => {
  test("schema is defined", () => {
    expect(breadboardSchema).toBeDefined();
  });

  test("schema id is defined", () => {
    expect(breadboardSchema.$id).toBeDefined();
  });
});
