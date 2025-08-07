/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual, ok } from "node:assert";
import test, { describe } from "node:test";
import { parsePath } from "../src/mcp-fs-backend.js";

describe("parsePath", () => {
  test("good path", () => {
    const parsing = parsePath("/mnt/mcp/type/name");
    deepStrictEqual(parsing, { type: "type", name: "name" });
  });
  test("invalid path", () => {
    {
      const parsing = parsePath("/env/foo");
      ok("$error" in parsing);
    }
    {
      const parsing = parsePath("/mnt/mcp/too");
      ok("$error" in parsing);
    }
    {
      const parsing = parsePath("/mnt/mcp//little");
      ok("$error" in parsing);
    }
    {
      const parsing = parsePath("/mnt/mcp/type/name/too/much");
      ok("$error" in parsing);
    }
  });
});
