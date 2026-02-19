/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { NotebookLmPickerController } from "../../../../../src/sca/controller/subcontrollers/editor/notebooklm-picker-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import type { Notebook } from "../../../../../src/sca/services/notebooklm-api-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotebook(
  id: string,
  displayName: string,
  emoji?: string
): Notebook {
  return {
    name: `notebooks/${id}`,
    displayName,
    emoji,
  } as Notebook;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("NotebookLmPickerController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  suite("filteredNotebooks", () => {
    test("returns all notebooks when no search query", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      const notebooks = [makeNotebook("1", "Alpha"), makeNotebook("2", "Beta")];
      nlm.notebooks = notebooks;
      nlm.searchQuery = "";
      assert.deepStrictEqual(nlm.filteredNotebooks, notebooks);
    });

    test("filters by display name (case-insensitive)", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      const alpha = makeNotebook("1", "Alpha Notebook");
      const beta = makeNotebook("2", "Beta Notebook");
      nlm.notebooks = [alpha, beta];
      nlm.searchQuery = "alpha";
      assert.deepStrictEqual(nlm.filteredNotebooks, [alpha]);
    });

    test("returns empty for no match", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      nlm.notebooks = [makeNotebook("1", "Alpha")];
      nlm.searchQuery = "zzz";
      assert.deepStrictEqual(nlm.filteredNotebooks, []);
    });

    test("trims query whitespace", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      const alpha = makeNotebook("1", "Alpha");
      nlm.notebooks = [alpha];
      nlm.searchQuery = "  alpha  ";
      assert.deepStrictEqual(nlm.filteredNotebooks, [alpha]);
    });
  });

  suite("toggleSelection", () => {
    test("adds to selection", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      nlm.toggleSelection("notebooks/1");
      assert.ok(nlm.selectedNotebooks.has("notebooks/1"));
    });

    test("removes from selection", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      nlm.selectedNotebooks = new Set(["notebooks/1"]);
      nlm.toggleSelection("notebooks/1");
      assert.ok(!nlm.selectedNotebooks.has("notebooks/1"));
    });

    test("toggle is idempotent (add then remove)", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      nlm.toggleSelection("notebooks/1");
      nlm.toggleSelection("notebooks/1");
      assert.strictEqual(nlm.selectedNotebooks.size, 0);
    });
  });

  suite("reset", () => {
    test("resets all fields to defaults", () => {
      const nlm = new NotebookLmPickerController("test", "test");
      nlm.pickerState = "error";
      nlm.notebooks = [makeNotebook("1", "Test")];
      nlm.errorMessage = "something broke";
      nlm.selectedNotebooks = new Set(["notebooks/1"]);
      nlm.searchQuery = "hello";
      nlm.pickerOpen = true;

      nlm.reset();

      assert.strictEqual(nlm.pickerState, "idle");
      assert.deepStrictEqual(nlm.notebooks, []);
      assert.strictEqual(nlm.errorMessage, "");
      assert.strictEqual(nlm.selectedNotebooks.size, 0);
      assert.strictEqual(nlm.searchQuery, "");
      assert.strictEqual(nlm.pickerOpen, false);
    });
  });
});
