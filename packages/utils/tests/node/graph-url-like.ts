/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "node:assert";
import test, { describe } from "node:test";
import { graphUrlLike } from "../../src/graph-url-like.js";

describe("graph url-like", () => {
  test("Recognizes strings of distinct URL-like structure", () => {
    ok(graphUrlLike("https://example.com"));
    ok(graphUrlLike("file:///path/to/file"));
    ok(graphUrlLike("data:text/plain,Hello%2C%20World"));
    ok(graphUrlLike("#foo"));
  });
  test("Rejects strings that are not URL-like", () => {
    ok(!graphUrlLike("specialist"));
    ok(!graphUrlLike("awesome-node-type"));
    ok(!graphUrlLike("https://"));
    ok(!graphUrlLike("foo#bar"));
  });
});
