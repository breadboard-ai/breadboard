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
  #map = new Map<NodeIdentifier, NodeDescriberResult>();

  get(id: NodeIdentifier) {
    return this.#map.get(id);
  }

  set(id: NodeIdentifier, result: NodeDescriberResult): NodeDescriberResult {
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
