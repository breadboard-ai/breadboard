/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import * as Formatter from "../../../../../src/sca/utils/logging/formatter.js";

suite("Log Formatter", () => {
  test("error", async () => {
    assert.deepStrictEqual(Formatter.error("My error", 3), {
      type: "error",
      args: ["My error", 3],
    });
  });

  test("warnings", async () => {
    assert.deepStrictEqual(Formatter.warning(3, "My warning"), {
      type: "warning",
      args: [3, "My warning"],
    });
  });

  test("info", async () => {
    assert.deepStrictEqual(Formatter.info({ tree: 1 }), {
      type: "info",
      args: [{ tree: 1 }],
    });
  });

  test("verbose", async () => {
    assert.deepStrictEqual(Formatter.verbose("A verbose message"), {
      type: "verbose",
      args: ["A verbose message"],
    });
  });
});
