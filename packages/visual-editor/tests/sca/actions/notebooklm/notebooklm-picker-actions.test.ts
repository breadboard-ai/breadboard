/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import * as NotebookLmPickerActions from "../../../../src/sca/actions/notebooklm/notebooklm-picker-actions.js";
import { NotebookLmPickerController } from "../../../../src/sca/controller/subcontrollers/editor/notebooklm-picker-controller.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { makeTestFixtures } from "../../helpers/index.js";
import { FakeNotebookLmApiClient } from "../../helpers/fake-notebooklm-api.js";
import type { Notebook } from "../../../../src/sca/services/notebooklm-api-client.js";

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

function setupNotebookLmPickerTest() {
  const { controller, services, mocks } = makeTestFixtures({
    withEditor: false,
  });

  const fakeClient = new FakeNotebookLmApiClient();
  (services as unknown as Record<string, unknown>).notebookLmApiClient =
    fakeClient;

  NotebookLmPickerActions.bind({ controller, services });

  const nlm = controller.editor
    .notebookLmPicker as unknown as NotebookLmPickerController;

  return { controller, services, mocks, nlm, fakeClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("NotebookLmPicker Actions", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  suite("fetchNotebooks", () => {
    test("sets loading state and populates notebooks", async () => {
      const { nlm, fakeClient } = setupNotebookLmPickerTest();
      fakeClient.addNotebook(makeNotebook("abc", "My Notes"));
      fakeClient.addNotebook(makeNotebook("def", "Research"));

      await NotebookLmPickerActions.fetchNotebooks();

      assert.strictEqual(
        fakeClient.calls.filter((c) => c.method === "listNotebooks").length,
        1
      );
      assert.strictEqual(nlm.pickerState, "idle");
      assert.strictEqual(nlm.notebooks.length, 2);
      assert.strictEqual(nlm.notebooks[0].displayName, "My Notes");
    });

    test("populates empty array when API returns no notebooks", async () => {
      const { nlm } = setupNotebookLmPickerTest();

      await NotebookLmPickerActions.fetchNotebooks();

      assert.strictEqual(nlm.pickerState, "idle");
      assert.strictEqual(nlm.notebooks.length, 0);
    });

    test("sets error state on API failure", async () => {
      const { nlm, fakeClient } = setupNotebookLmPickerTest();
      fakeClient.setError(new Error("Network error"));

      await NotebookLmPickerActions.fetchNotebooks();

      assert.strictEqual(nlm.pickerState, "error");
      assert.strictEqual(nlm.errorMessage, "Network error");
      assert.strictEqual(nlm.notebooks.length, 0);
    });

    test("clears previous error on new fetch", async () => {
      const { nlm, fakeClient } = setupNotebookLmPickerTest();
      fakeClient.addNotebook(makeNotebook("1", "Test"));

      // Simulate a previous error
      nlm.pickerState = "error";
      nlm.errorMessage = "old error";

      await NotebookLmPickerActions.fetchNotebooks();

      assert.strictEqual(nlm.pickerState, "idle");
      assert.strictEqual(nlm.errorMessage, "");
    });
  });

  suite("confirmSelection", () => {
    test("returns values for selected notebooks and resets", async () => {
      const { nlm } = setupNotebookLmPickerTest();
      nlm.notebooks = [
        makeNotebook("abc", "Alpha", "📓"),
        makeNotebook("def", "Beta"),
        makeNotebook("ghi", "Gamma"),
      ];
      nlm.selectedNotebooks = new Set(["notebooks/abc", "notebooks/ghi"]);
      nlm.pickerOpen = true;

      const values = await NotebookLmPickerActions.confirmSelection();

      assert.strictEqual(values.length, 2);
      assert.deepStrictEqual(values[0], {
        id: "abc",
        name: "notebooks/abc",
        preview: "Alpha",
        emoji: "📓",
      });
      assert.deepStrictEqual(values[1], {
        id: "ghi",
        name: "notebooks/ghi",
        preview: "Gamma",
        emoji: undefined,
      });

      // Controller should be reset
      assert.strictEqual(nlm.pickerOpen, false);
      assert.strictEqual(nlm.selectedNotebooks.size, 0);
      assert.strictEqual(nlm.notebooks.length, 0);
    });

    test("uses notebook ID as preview when displayName missing", async () => {
      const { nlm } = setupNotebookLmPickerTest();
      nlm.notebooks = [{ name: "notebooks/abc" } as Notebook];
      nlm.selectedNotebooks = new Set(["notebooks/abc"]);

      const values = await NotebookLmPickerActions.confirmSelection();

      assert.strictEqual(values[0].preview, "abc");
    });

    test("returns empty array when nothing selected", async () => {
      const { nlm } = setupNotebookLmPickerTest();
      nlm.notebooks = [makeNotebook("abc", "Alpha")];
      nlm.selectedNotebooks = new Set();

      const values = await NotebookLmPickerActions.confirmSelection();

      assert.strictEqual(values.length, 0);
    });
  });
});
