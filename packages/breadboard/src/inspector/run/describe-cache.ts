/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeIdentifier } from "@breadboard-ai/types";
import type { NodeDescriberResult } from "../../types.js";
import { InspectableDescriberResultCache } from "../types.js";

export { DescribeResultCache };

class DescribeResultCache implements InspectableDescriberResultCache {
  #map = new Map<NodeIdentifier, Promise<NodeDescriberResult>>();

  getOrCreate(
    id: NodeIdentifier,
    factory: () => Promise<NodeDescriberResult>
  ): Promise<NodeDescriberResult> {
    let result = this.#map.get(id);
    if (result) {
      return result;
    }
    result = factory();
    this.#map.set(id, result);
    return result;
  }

  clear(visualOnly: boolean, affectedNodes: NodeIdentifier[]) {
    if (visualOnly) {
      return;
    }
    affectedNodes.forEach((id) => {
      this.#map.delete(id);
    });
  }
}
