/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CapabilitiesManager,
  CapabilitySpec,
} from "@breadboard-ai/types/sandbox.js";

export { CapabilitiesManagerImpl };

class CapabilitiesManagerImpl implements CapabilitiesManager {
  createSpec(): CapabilitySpec {
    return CapabilitiesManagerImpl.dummies();
  }

  static #dummies?: CapabilitySpec;

  static dummies(): CapabilitySpec {
    if (this.#dummies) return this.#dummies;

    this.#dummies = Object.fromEntries(
      ["read", "write"].map((name) => {
        return [name, () => ({ $error: "Capability not available" })];
      })
    );
    return this.#dummies;
  }
}
