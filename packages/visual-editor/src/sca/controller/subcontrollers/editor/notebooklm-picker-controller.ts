/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Notebook } from "../../../services/notebooklm-api-client.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

export { NotebookLmPickerController };

/**
 * Value returned when a notebook is picked from the picker.
 */
export type NotebookPickedValue = {
  /** A special value recognized by the "GraphPortLabel": if present, used as the preview. */
  preview: string;
  /** The notebook ID (without notebooks/ prefix). */
  id: string;
  /** The full resource name (notebooks/{id}). */
  name: string;
  /** Optional emoji for display. */
  emoji?: string;
};

type PickerState = "idle" | "loading" | "error";

class NotebookLmPickerController extends RootController {
  @field()
  accessor pickerState: PickerState = "idle";

  @field({ deep: false })
  accessor notebooks: Notebook[] = [];

  @field()
  accessor errorMessage = "";

  @field({ deep: false })
  accessor selectedNotebooks: Set<string> = new Set();

  @field()
  accessor searchQuery = "";

  @field()
  accessor pickerOpen = false;

  /**
   * Callback invoked when the picker confirms selection.
   * Set by the `open` action; cleared by `reset()`.
   */
  onConfirm: ((values: NotebookPickedValue[]) => void) | null = null;

  get filteredNotebooks(): Notebook[] {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      return this.notebooks;
    }
    return this.notebooks.filter((nb) =>
      (nb.displayName ?? "").toLowerCase().includes(query)
    );
  }

  toggleSelection(name: string) {
    const updated = new Set(this.selectedNotebooks);
    if (updated.has(name)) {
      updated.delete(name);
    } else {
      updated.add(name);
    }
    this.selectedNotebooks = updated;
  }

  reset() {
    this.pickerState = "idle";
    this.notebooks = [];
    this.errorMessage = "";
    this.selectedNotebooks = new Set();
    this.searchQuery = "";
    this.pickerOpen = false;
    this.onConfirm = null;
  }
}
