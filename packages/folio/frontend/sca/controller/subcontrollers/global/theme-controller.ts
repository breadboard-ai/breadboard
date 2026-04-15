/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import type { ThemeMode } from "../../../types.js";

export class ThemeController extends RootController {
  @field({ persist: "local" })
  accessor mode: ThemeMode = "auto";

  constructor() {
    super("Theme", "ThemeController");
  }
}
