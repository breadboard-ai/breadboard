/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InspectableKitCache,
  InspectableNodeType,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";

export { KitCache };

/**
 * A no-op implementation of InspectableKitCache.
 * Kept to satisfy the MutableGraph interface contract.
 */
class KitCache implements InspectableKitCache {
  constructor() {}

  getType(_id: NodeTypeIdentifier): InspectableNodeType | undefined {
    return undefined;
  }
  addType(_id: NodeTypeIdentifier, _type: InspectableNodeType): void {}

  rebuild(_graph: GraphDescriptor) {}
}
