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
  NodeMetadata,
} from "@breadboard-ai/types";
import { EdgeAttachmentPoint } from "../../types/types";

type Namespace = "node";

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

export interface ChangeEdgeAttachment {
  readonly eventType: `${Namespace}.changeedgeattachment`;
  readonly graphId: GraphIdentifier;
  readonly edge: Edge;
  readonly which: "from" | "to";
  readonly attachmentPoint: EdgeAttachmentPoint;
}
