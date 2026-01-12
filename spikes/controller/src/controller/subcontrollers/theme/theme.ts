/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debug, debugContainer } from "../../decorators/debug.js";
import { field } from "../../decorators/field.js";
import { RootStore } from "../root-store.js";

@debugContainer({ path: "theme" })
export class ThemeStore extends RootStore {
  @field({ persist: "idb" })
  private accessor _mode: "light" | "dark" = "light";

  @debug({
    ui: {
      view: "list",
      label: "Mode",
      options: [
        {
          text: "Dark Mode",
          value: "dark",
        },
        {
          text: "Light Mode",
          value: "light",
        },
      ],
      value: "light",
    },
  })
  get mode() {
    return this._mode;
  }
  set mode(mode: "light" | "dark") {
    this._mode = mode;
  }

  toggleMode() {
    this._mode = this._mode === "light" ? "dark" : "light";
  }
}
