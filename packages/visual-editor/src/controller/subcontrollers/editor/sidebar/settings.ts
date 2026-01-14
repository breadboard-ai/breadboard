/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debug } from "../../../decorators/debug.js";
import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export class SettingsController extends RootController {
  @field({ persist: "local" })
  private accessor _section: "console" | "edit-history" | "editor" | "preview" =
    "preview";

  get section() {
    return this._section;
  }

  @debug({
    log: {
      label: "Sidebar",
      format(val, formatter) {
        return formatter.info(val);
      },
    },
  })
  set section(value: "console" | "edit-history" | "editor" | "preview") {
    this._section = value;
  }
}
