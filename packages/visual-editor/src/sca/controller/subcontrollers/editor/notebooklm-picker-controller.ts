/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Notebook } from "../../../services/notebooklm-api-client.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

export { NotebookLmPickerController };

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
  }
}
