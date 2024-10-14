/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier } from "@breadboard-ai/types";
import { ComponentActivityItem, TopGraphNodeInfo } from "../../types/types";

export type NodeActivityMap = Map<NodeIdentifier, ComponentActivityItem[]>;
export type CanRunStateMap = Map<NodeIdentifier, boolean>;

export { NodeInformation };

class NodeInformation implements TopGraphNodeInfo {
  #activity: NodeActivityMap;
  #canRunState: CanRunStateMap;

  constructor(activity: NodeActivityMap, canRunState: CanRunStateMap) {
    this.#activity = activity;
    this.#canRunState = canRunState;
  }

  getActivity(node: NodeIdentifier): ComponentActivityItem[] | undefined {
    return this.#activity.get(node);
  }

  canRunNode(node: NodeIdentifier): boolean {
    // There are three reasons why a given node can be runnable:
    // 1. When the node has already been visited during the current run, so a
    //    new run can be resumed from this node
    // 2. When the node has all the inputs properly satisfied, but hasn't been
    //    visited yet. In this case, we should be able to construct a new run,
    //    even though that node does not exist in it yet.
    return !!this.#canRunState.get(node);
  }
}
