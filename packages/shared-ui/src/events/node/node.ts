/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EditSpec,
  GraphIdentifier,
  NodeConfiguration,
  NodeDescriptor,
  NodeMetadata,
} from "@breadboard-ai/types";
import { EdgeAttachmentPoint } from "../../types/types";
import { BaseEventDetail } from "../base";

type Namespace = "node";

export interface Action extends BaseEventDetail<`${Namespace}.action`> {
  readonly nodeId: string;
  readonly subGraphId: string | null;
  /**
   * The type of action.
   * - `primary` -- the action triggered by tapping the primary action button.
   */
  readonly action: "primary";
}

export interface AddWithEdge
  extends BaseEventDetail<`${Namespace}.addwithedge`> {
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

export interface MultiChange
  extends BaseEventDetail<`${Namespace}.multichange`> {
  readonly edits: EditSpec[];
  readonly description: string;
  readonly subGraphId: string | null;
}

export interface ChangeEdge extends BaseEventDetail<`${Namespace}.changeedge`> {
  readonly changeType: "add" | "remove" | "move";
  readonly from: Edge;
  readonly to?: Edge;
  readonly subGraphId: string | null;
}

export interface ChangeEdgeAttachmentPoint
  extends BaseEventDetail<`${Namespace}.changeedgeattachmentpoint`> {
  readonly graphId: GraphIdentifier;
  readonly edge: Edge;
  readonly which: "from" | "to";
  readonly attachmentPoint: EdgeAttachmentPoint;
}
