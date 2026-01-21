/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../decorators/field.js";
import { DebugController as DebugControllerInterface } from "../types.js";
import { RootController } from "./root-controller.js";

export class DebugController
  extends RootController
  implements DebugControllerInterface
{
  @field({ persist: "local" })
  private accessor _enabled = false;

  get enabled() {
    return this._enabled;
  }
  set enabled(value: boolean) {
    this._enabled = value;
  }
}
