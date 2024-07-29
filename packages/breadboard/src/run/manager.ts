/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LifecycleManager } from "./lifecycle.js";
import { Reanimator } from "./reanimator.js";
import type { ManagedRunState, ReanimationController } from "./types.js";

export class RunStateManager implements ManagedRunState {
  #lifecycle: LifecycleManager;

  constructor() {
    this.#lifecycle = new LifecycleManager([]);
  }

  lifecycle() {
    // TODO: Lifecycle during reanimation should be doing
    // nothing, since we're reconstructing the state of
    // the run from a previously saved state.
    return this.#lifecycle;
  }

  reanimation(): ReanimationController {
    // Always return the new instance:
    // wraps the actual ReanimationFrame, if any.
    return new Reanimator(undefined);
  }
}
