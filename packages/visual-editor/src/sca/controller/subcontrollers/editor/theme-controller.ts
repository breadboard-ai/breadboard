/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

export { ThemeController };

export type ThemeStatus = "generating" | "uploading" | "editing" | "idle";

class ThemeController extends RootController {
  @field()
  accessor status: ThemeStatus = "idle";
}
