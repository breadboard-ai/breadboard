/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InspectableGraphOptions,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { GraphStore } from "../../src/engine/inspector/graph-store.js";
import { makeFs } from "../test-file-system.js";

export { makeTestGraphStore };

function makeTestGraphStore(options: InspectableGraphOptions = {}) {
  return new GraphStore({
    kits: options.kits || [],
    fileSystem: makeFs(),
    sandbox: options.sandbox || {
      createRunnableModule() {
        throw new Error("Do not use sandbox with test graph store");
      },
    },
    loader: options.loader || {
      load() {
        throw new Error("Do not load graphs with test graph store");
      },
    },
    flags: {
      env: () => {
        throw new Error("Do not use flags with test graph store");
      },
      overrides: () => {
        throw new Error("Do not use flags with test graph store");
      },
      flags: () => {
        throw new Error("Do not use flags with test graph store");
      },
      override() {
        throw new Error("Do not use flags with test graph store");
      },
      clearOverride() {
        throw new Error("Do not use flags with test graph store");
      },
    } satisfies RuntimeFlagManager,
  });
}
