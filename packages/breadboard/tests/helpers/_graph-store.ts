/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphStore } from "../../src/index.js";

export { makeTestGraphStore };

function makeTestGraphStore() {
  return new GraphStore({
    kits: [],
    sandbox: {
      runModule() {
        throw new Error("Do not run modules with test graph store");
      },
    },
    loader: {
      load() {
        throw new Error("Do not load graphs with test graph store");
      },
    },
  });
}
