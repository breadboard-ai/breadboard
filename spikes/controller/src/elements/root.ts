/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement } from "lit";
import { property } from "lit/decorators.js";
import { Controller } from "../controller/controller.js";
import { SignalWatcher } from "@lit-labs/signals";
import { controllerContext } from "../controller/context/context.js";
import { consume } from "@lit/context";

export abstract class Root extends SignalWatcher(LitElement) {
  @property()
  @consume({ context: controllerContext })
  accessor controller!: Controller;
}
