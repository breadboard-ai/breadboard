/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { parseSheetName } from "../../src/a2/google-drive/sheet-manager.js";
import { deepStrictEqual } from "node:assert";

describe("parseSheetName", () => {
  it("extracts simple sheet name from range", () => {
    deepStrictEqual(parseSheetName("Sheet1!A1:B10"), "Sheet1");
  });

  it("extracts quoted sheet name with spaces", () => {
    deepStrictEqual(parseSheetName("'My Sheet'!A1:B10"), "My Sheet");
  });

  it("extracts quoted sheet name with special characters", () => {
    deepStrictEqual(parseSheetName("'Sheet (1)'!A1"), "Sheet (1)");
  });

  it("returns null for range without sheet name", () => {
    deepStrictEqual(parseSheetName("A1:B10"), null);
  });

  it("returns null for simple cell reference", () => {
    deepStrictEqual(parseSheetName("A1"), null);
  });

  it("handles encoded sheet names", () => {
    deepStrictEqual(parseSheetName("Scores!A:ZZ"), "Scores");
  });
});
