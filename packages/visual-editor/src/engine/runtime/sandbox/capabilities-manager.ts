/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlerContext } from "@breadboard-ai/types";
import { FileSystemHandlerFactory } from "./file-system-handler-factory.js";
import {
  CapabilitiesManager,
  CapabilitySpec,
} from "@breadboard-ai/types/sandbox.js";

export { CapabilitiesManagerImpl };

class CapabilitiesManagerImpl implements CapabilitiesManager {
  constructor(public readonly context?: NodeHandlerContext) {}

  createSpec(): CapabilitySpec {
    try {
      if (this.context) {
        const fs = new FileSystemHandlerFactory(this.context.fileSystem);
        return {
          query: fs.query(),
          read: fs.read(),
          write: fs.write(),
        };
      }
    } catch (e) {
      console.warn(`Unable to create spec: ${(e as Error).message}`);
    }
    return CapabilitiesManagerImpl.dummies();
  }

  static #dummies?: CapabilitySpec;

  static dummies(): CapabilitySpec {
    if (this.#dummies) return this.#dummies;

    this.#dummies = Object.fromEntries(
      ["query", "read", "write"].map((name) => {
        return [name, () => ({ $error: "Capability not available" })];
      })
    );
    return this.#dummies;
  }
}
