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

type Namespace = "node";

export interface AddWithEdge {
  readonly eventType: `${Namespace}.addwithedge`;
  readonly node: NodeDescriptor;
  readonly edge: Edge;
  readonly subGraphId: string | null;
}

export interface Change {
  readonly eventType: `${Namespace}.change`;
  readonly id: string;
  readonly configurationPart: NodeConfiguration;
  readonly subGraphId: string | null;
  readonly metadata: NodeMetadata | null;
  readonly ins: { path: string; title: string }[] | null;
}

export interface MultiChange {
  readonly eventType: `${Namespace}.multichange`;
  readonly edits: EditSpec[];
  readonly description: string;
  readonly subGraphId: string | null;
}

export interface ChangeEdge {
  readonly eventType: `${Namespace}.changeedge`;
  readonly changeType: "add" | "remove" | "move";
  readonly from: Edge;
  readonly to?: Edge;
  readonly subGraphId: string | null;
}

export interface ChangeEdgeAttachmentPoint {
  readonly eventType: `${Namespace}.changeedgeattachmentpoint`;
  readonly graphId: GraphIdentifier;
  readonly edge: Edge;
  readonly which: "from" | "to";
  readonly attachmentPoint: EdgeAttachmentPoint;
}
