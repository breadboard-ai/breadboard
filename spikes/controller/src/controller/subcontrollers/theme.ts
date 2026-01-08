/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { api } from "../decorators/api.js";

export class ThemeStore {
  @api({ persist: "idb" })
  private accessor _mode: "light" | "dark" = "light";

  get mode() {
    return this._mode;
  }

  toggleMode() {
    this._mode = this._mode === "light" ? "dark" : "light";
  }
}
