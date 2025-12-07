/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphStoreArgs, MutableGraphStore } from "@breadboard-ai/types";
import { GraphStore } from "./graph-store.js";

export function createGraphStore(args: GraphStoreArgs): MutableGraphStore {
  return new GraphStore(args);
}
