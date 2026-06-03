/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export class WorkbenchController extends RootController {
  @field()
  accessor eligible = false;

  @field({ persist: "session" })
  accessor view: "workbench" | "classic" = "workbench";

  @field({ persist: "session", deep: true })
  accessor splits: [number, number, number] = [1, 2, 1];
}
