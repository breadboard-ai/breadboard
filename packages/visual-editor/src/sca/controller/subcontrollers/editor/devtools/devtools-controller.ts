/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export class DevToolsController extends RootController {
  @field({ persist: "session" })
  accessor isOpen = false;
}
