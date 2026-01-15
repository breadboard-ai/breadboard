/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { substituteDefaultTool } from "../../src/a2/agent/substitute-default-tool.js";
import { deepStrictEqual } from "node:assert";

describe(`Default tool substitution`, () => {
  it("substitutes default tool", () => {
    const substitute = substituteDefaultTool({
      path: "embed://a2/tools.bgl.json#module:search-web",
      title: "Search Web",
      type: "tool",
    });
    deepStrictEqual(substitute, "Google Search grounding");
  });

  it("returns null for non-default tools", () => {
    const substitute = substituteDefaultTool({
      path: "another tool",
      title: "Some Other Tool",
      type: "tool",
    });
    deepStrictEqual(substitute, null);
  });
});
