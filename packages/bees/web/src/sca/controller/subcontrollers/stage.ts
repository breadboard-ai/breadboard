/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../decorators/field.js";
import { RootController } from "./root-controller.js";

export class StageController extends RootController {
  constructor() {
    super("stage", "stage");
  }

  @field() accessor currentView: string | null = null;
  @field() accessor digestTicketId: string | null = null;
  @field() accessor digestLoading = false;
}
