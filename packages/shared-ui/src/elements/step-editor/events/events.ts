/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Edge, GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  EdgeAttachmentPoint,
  HighlightStateWithChangeId,
  NewAsset,
} from "../../../types/types";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class SelectionTranslateEvent extends Event {
  static eventName = "bbselectiontranslate" as const;

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly hasSettled = false
  ) {
    super(SelectionTranslateEvent.eventName, { ...eventInit });
  }
}

export class SelectionMoveEvent extends Event {
  static eventName = "bbselectionmove" as const;

  constructor(
    public readonly eventX: number,
    public readonly eventY: number,
    public readonly deltaX: number,
    public readonly deltaY: number,
    public readonly hasSettled = false
  ) {
    super(SelectionMoveEvent.eventName, { ...eventInit });
  }
}
export class GraphEdgeAttachmentMoveEvent extends Event {
  static eventName = "bbgraphedgeattachmentmove" as const;

  constructor(
    public readonly edge: Edge,
    public readonly which: "from" | "to",
    public readonly value: EdgeAttachmentPoint
  ) {
    super(GraphEdgeAttachmentMoveEvent.eventName, { ...eventInit });
  }
}

export class SelectGraphContentsEvent extends Event {
  static eventName = "bbselectgraphcontents" as const;

  constructor(public readonly graphId: GraphIdentifier) {
    super(SelectGraphContentsEvent.eventName, { ...eventInit });
  }
}

export class NodeAddEvent extends Event {
  static eventName = "bbnodeadd" as const;

  constructor(
    public readonly nodeType: string,
    public readonly createAtCenter: boolean,
    public readonly x?: number,
    public readonly y?: number,
    public readonly connectedTo?: NodeIdentifier,
    public readonly subGraphId?: GraphIdentifier
  ) {
    super(NodeAddEvent.eventName, { ...eventInit });
  }
}

export class NodeSelectEvent extends Event {
  static eventName = "bbnodeselect" as const;

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly connectedTo?: NodeIdentifier
  ) {
    super(NodeSelectEvent.eventName, { ...eventInit });
  }
}

export class NodeConnectStartEvent extends Event {
  static eventName = "bbnodeconnectstart" as const;

  constructor(public readonly nodeId: NodeIdentifier) {
    super(NodeConnectStartEvent.eventName, { ...eventInit });
  }
}

export class NodeBoundsUpdateRequestEvent extends Event {
  static eventName = "bbnodeboundsupdaterequest" as const;

  constructor() {
    super(NodeBoundsUpdateRequestEvent.eventName, { ...eventInit });
  }
}

export class NodeConfigurationRequestEvent extends Event {
  static eventName = "bbnodeconfigurationrequest" as const;

  constructor(
    public readonly nodeId: NodeIdentifier,
    public readonly bounds: DOMRect | null = null
  ) {
    super(NodeConfigurationRequestEvent.eventName, { ...eventInit });
  }
}

export class HighlightEvent extends Event {
  static eventName = "bbhighlight" as const;

  constructor(
    public readonly highlightState: HighlightStateWithChangeId | null
  ) {
    super(HighlightEvent.eventName, { ...eventInit });
  }
}

export class CreateNewAssetsEvent extends Event {
  static eventName = "bbcreatenewasset" as const;

  constructor(public readonly assets: NewAsset[]) {
    super(CreateNewAssetsEvent.eventName, { ...eventInit });
  }
}
