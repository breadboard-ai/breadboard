/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export class SidebarController extends RootController {
  @field({ persist: "local" })
  accessor section: "console" | "edit-history" | "editor" | "preview" =
    "preview";
}
