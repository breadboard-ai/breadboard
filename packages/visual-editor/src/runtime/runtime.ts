/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeConfig } from "./types.js";

export * as Events from "./events.js";
export * as Types from "./types.js";

import { Select } from "./select.js";
import { StateManager } from "./state.js";

export class Runtime extends EventTarget {
  public readonly select: Select;
  public readonly state: StateManager;

  constructor(config: RuntimeConfig) {
    super();

    const sca = config.sca;
    if (!sca) throw new Error("Expected SCA");

    this.select = new Select();
    this.state = new StateManager(sca);
  }
}
