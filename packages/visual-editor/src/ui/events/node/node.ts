/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  GraphIdentifier,
  NodeConfiguration,
  NodeDescriptor,
  NodeMetadata,
} from "@breadboard-ai/types";
import { EdgeAttachmentPoint } from "../../types/types.js";
import { BaseEventDetail } from "../base.js";

type Namespace = "node";

export interface Action extends BaseEventDetail<`${Namespace}.action`> {
  readonly nodeId: string;
  readonly subGraphId: string | null;
  /**
   * The context of the action. Where was the action button tapped?
   *  - `console` -- the button was tapped in the console
   *  - `graph` -- the button was tapped in the graph
   */
  readonly actionContext: "console" | "graph" | null;
}

export interface AddWithEdge extends BaseEventDetail<`${Namespace}.addwithedge`> {
  readonly node: NodeDescriptor;
  readonly edge: Edge;
  readonly subGraphId: string | null;
}

export interface Change extends BaseEventDetail<`${Namespace}.change`> {
  readonly id: string;
  readonly configurationPart: NodeConfiguration;
  readonly subGraphId: string | null;
  readonly metadata: NodeMetadata | null;
  readonly ins: { path: string; title: string }[] | null;
}

/**
 * Event for adding a single node to the graph.
 */
export interface Add extends BaseEventDetail<`${Namespace}.add`> {
  readonly node: NodeDescriptor;
  readonly graphId: GraphIdentifier;
}

/**
 * Position update for a node or asset during selection move.
 */
export interface SelectionPositionUpdate {
  readonly type: "node" | "asset";
  readonly id: string;
  readonly graphId: GraphIdentifier;
  readonly x: number;
  readonly y: number;
}

/**
 * Event for updating positions of selected nodes and assets.
 */
export interface MoveSelection extends BaseEventDetail<`${Namespace}.moveselection`> {
  readonly updates: SelectionPositionUpdate[];
}

export interface ChangeEdge extends BaseEventDetail<`${Namespace}.changeedge`> {
  readonly changeType: "add" | "remove" | "move";
  readonly from: Edge;
  readonly to?: Edge;
  readonly subGraphId: string | null;
}

export interface ChangeEdgeAttachmentPoint extends BaseEventDetail<`${Namespace}.changeedgeattachmentpoint`> {
  readonly graphId: GraphIdentifier;
  readonly edge: Edge;
  readonly which: "from" | "to";
  readonly attachmentPoint: EdgeAttachmentPoint;
}
