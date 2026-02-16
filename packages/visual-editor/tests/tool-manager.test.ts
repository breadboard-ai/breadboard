/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import { describe, it } from "node:test";
import { ROUTE_TOOL_PATH, ToolManager } from "../src/a2/a2/tool-manager.js";
import { stubModuleArgs } from "./useful-stubs.js";

describe("Tool Manager", () => {
  it("can add routes, but ignores them", async () => {
    const manager = new ToolManager(stubModuleArgs);
    deepStrictEqual(manager.list.length, 0);
    const result = await manager.addTool({
      type: "tool",
      title: "Route A",
      path: ROUTE_TOOL_PATH,
      instance: "foo",
    });
    deepStrictEqual(result, "");
    deepStrictEqual(manager.list.length, 0);
  });
});
