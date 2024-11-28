/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphStore, InspectableGraphOptions } from "../../src/index.js";

export { makeTestGraphStore };

function makeTestGraphStore(options: InspectableGraphOptions = {}) {
  return new GraphStore({
    kits: options.kits || [],
    sandbox: options.sandbox || {
      runModule() {
        throw new Error("Non-existent sandbox: Terrible Options were used.");
      },
    },
    loader: options.loader || {
      load() {
        throw new Error("Do not load graphs with test graph store");
      },
    },
  });
}