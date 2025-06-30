/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InspectableGraphOptions } from "@breadboard-ai/types";
import { GraphStore } from "../../src/inspector/graph-store.js";
import { makeFs } from "../node/test-file-system.js";

export { makeTestGraphStore };

function makeTestGraphStore(options: InspectableGraphOptions = {}) {
  return new GraphStore({
    kits: options.kits || [],
    fileSystem: makeFs(),
    sandbox: options.sandbox || {
      runModule() {
        throw new Error("Do not use sandbox with test graph store");
      },
    },
    loader: options.loader || {
      load() {
        throw new Error("Do not load graphs with test graph store");
      },
    },
  });
}
