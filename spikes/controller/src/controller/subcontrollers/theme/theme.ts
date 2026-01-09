/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootStore } from "../root-store.js";

export class ThemeStore extends RootStore {
  @field({ persist: "idb" })
  private accessor _mode: "light" | "dark" = "light";

  get mode() {
    return this._mode;
  }

  toggleMode() {
    this._mode = this._mode === "light" ? "dark" : "light";
  }
}
