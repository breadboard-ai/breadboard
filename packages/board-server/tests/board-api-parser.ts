/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import {
  parse,
  BoardAPIParser,
} from "../src/server/boards/utils/board-api-parser.js";
import { deepStrictEqual, ok } from "assert";
import data from "./parser-data.json" with { type: "json" };

describe("Board API Parser", () => {
  test("recognizes Board API entry", (t) => {
    ok(
      new BoardAPIParser(
        new URL("http://localhost/boards/foo"),
        "GET"
      ).isBoardURL()
    );

    ok(
      new BoardAPIParser(
        new URL("http://example.com/boards"),
        "GET"
      ).isBoardURL()
    );

    ok(
      !new BoardAPIParser(
        new URL("http://localhost/beards"),
        "GET"
      ).isBoardURL()
    );
  });

  test("parses Board API ", (t) => {
    for (const { url, method, result } of data) {
      deepStrictEqual(parse(new URL(url), method), result);
    }
  });
});
