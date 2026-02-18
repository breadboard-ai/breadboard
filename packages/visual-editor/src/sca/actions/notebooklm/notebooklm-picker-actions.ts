/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import type { NotebookPickedValue } from "../../../ui/elements/notebooklm-picker/notebooklm-picker.js";
import { Utils } from "../../utils.js";

const LABEL = "NotebookLmPicker";

export { bind, fetchNotebooks, confirmSelection };

const bind = makeAction();

/**
 * Fetches the user's notebooks from the NotebookLM API
 * and populates the controller state.
 */
const fetchNotebooks = asAction(
  "NotebookLmPicker.fetchNotebooks",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const nlm = controller.editor.notebookLmPicker;
    nlm.pickerState = "loading";
    nlm.notebooks = [];
    nlm.errorMessage = "";

    try {
      const response = await services.notebookLmApiClient.listNotebooks({});
      nlm.notebooks = response.notebooks || [];
      nlm.pickerState = "idle";
    } catch (err) {
      Utils.Logging.getLogger().log(
        Utils.Logging.Formatter.error("Failed to fetch notebooks:", err),
        LABEL
      );
      nlm.pickerState = "error";
      nlm.errorMessage =
        err instanceof Error ? err.message : "Failed to fetch notebooks";
    }
  }
);

/**
 * Converts the currently selected notebooks into `NotebookPickedValue[]`
 * and closes the picker.
 */
const confirmSelection = asAction(
  "NotebookLmPicker.confirmSelection",
  { mode: ActionMode.Immediate },
  async (): Promise<NotebookPickedValue[]> => {
    const { controller } = bind;
    const nlm = controller.editor.notebookLmPicker;

    const values: NotebookPickedValue[] = nlm.notebooks
      .filter((nb) => nlm.selectedNotebooks.has(nb.name))
      .map((nb) => {
        const id = nb.name.replace("notebooks/", "");
        return {
          id,
          name: nb.name,
          preview: nb.displayName || id,
          emoji: nb.emoji,
        };
      });

    nlm.reset();
    return values;
  }
);
