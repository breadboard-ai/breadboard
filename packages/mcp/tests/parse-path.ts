/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual, ok } from "node:assert";
import test, { describe } from "node:test";
import { parsePath } from "../src/mcp-fs-backend.js";

describe("parsePath", () => {
  test("handshake path", () => {
    const parsing = parsePath("/mnt/mcp/session");
    deepStrictEqual(parsing, { type: "handshake" });
  });
  test("session path", () => {
    const parsing = parsePath("/mnt/mcp/session/foo/callTool");
    deepStrictEqual(parsing, {
      type: "session",
      id: "foo",
      method: "callTool",
    });
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
      const parsing = parsePath("/mnt/mcp/session/id/callTool/much");
      ok("$error" in parsing);
    }
    {
      const parsing = parsePath("/mnt/mcp/session/foo/bar");
      ok("$error" in parsing);
    }
  });
});
