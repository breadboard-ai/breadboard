/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RootController } from "./root-controller.js";
import type { ToastMessage } from "../../types.js";
import { field } from "../decorators/field.js";
import type { PulseTask } from "../../types.js";
import type { TicketData } from "../../../data/types.js";

export class GlobalController extends RootController {
  constructor() {
    super("global", "global");
  }

  @field() accessor pulseText = "";
  get pulseActive() {
    return this.pulseTasks.some((t) => t.status === "running");
  }
  @field({ deep: true }) accessor pulseTasks: PulseTask[] = [];
  @field({ deep: true }) accessor toasts: ToastMessage[] = [];
  @field({ deep: true }) accessor previousTicketStatuses = new Map<
    string,
    string
  >();
  @field({ deep: true }) accessor tickets: TicketData[] = [];
  @field() accessor draining = false;
}
