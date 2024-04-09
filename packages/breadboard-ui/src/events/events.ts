/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InspectableEdge,
  NodeConfiguration,
} from "@google-labs/breadboard";
import type { Settings } from "../types/types.js";

export class StartEvent extends Event {
  static eventName = "breadboardstart";

  constructor(
    public url: string | null = null,
    public descriptor: GraphDescriptor | null = null
  ) {
    super(StartEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });

    if (!url && !descriptor) {
      throw new Error(
        "You must provide either a URL or descriptor; none provided"
      );
    }

    if (url && descriptor) {
      throw new Error(
        "You must provide either a URL or descriptor, but not both"
      );
    }
  }
}

export class FileDropEvent extends Event {
  static eventName = "breadboardfiledrop";

  constructor(
    public readonly url: string,
    public readonly descriptor: GraphDescriptor
  ) {
    super(FileDropEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class KitNodeChosenEvent extends Event {
  static eventName = "breadboardkitnodechosen";

  constructor(public nodeType: string) {
    super(KitNodeChosenEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class SubGraphChosenEvent extends Event {
  static eventName = "breadboardsubgraphchosen";

  constructor(public subGraphId: string) {
    super(SubGraphChosenEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class SubGraphDeleteEvent extends Event {
  static eventName = "breadboardsubgraphdelete";

  constructor(public subGraphId: string) {
    super(SubGraphDeleteEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class SubGraphCreateEvent extends Event {
  static eventName = "breadboardsubgraphcreate";

  constructor(public subGraphId: string) {
    super(SubGraphCreateEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class BreadboardOverlayDismissedEvent extends Event {
  static eventName = "breadboardboardoverlaydismissed";

  constructor() {
    super(BreadboardOverlayDismissedEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class BoardInfoUpdateEvent extends Event {
  static eventName = "breadboardboardinfoupdate";

  constructor(
    public readonly title: string,
    public readonly version: string,
    public readonly description: string
  ) {
    super(BoardInfoUpdateEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class SettingsUpdateEvent extends Event {
  static eventName = "breadboardboardsettingsupdate";

  constructor(public readonly settings: Settings) {
    super(SettingsUpdateEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphProviderConnectRequestEvent extends Event {
  static eventName = "graphproviderconnectrequest";

  constructor(public readonly providerName: string) {
    super(GraphProviderConnectRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphProviderDeleteRequestEvent extends Event {
  static eventName = "graphproviderdeleterequest";

  constructor(
    public readonly providerName: string,
    public readonly url: string,
    public readonly isActive: boolean
  ) {
    super(GraphProviderDeleteRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphProviderLoadRequestEvent extends Event {
  static eventName = "graphproviderloadrequest";

  constructor(
    public readonly providerName: string,
    public readonly url: string
  ) {
    super(GraphProviderLoadRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphProviderRenewAccessRequestEvent extends Event {
  static eventName = "graphproviderrenewaccesssrequest";

  constructor(
    public readonly providerName: string,
    public readonly location: string
  ) {
    super(GraphProviderRenewAccessRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphProviderDisconnectEvent extends Event {
  static eventName = "graphproviderdisconnect";

  constructor(
    public readonly providerName: string,
    public readonly location: string
  ) {
    super(GraphProviderDisconnectEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphProviderBlankBoardEvent extends Event {
  static eventName = "graphproviderblankboard";

  constructor(
    public readonly providerName: string,
    public readonly location: string,
    public readonly fileName: string
  ) {
    super(GraphProviderBlankBoardEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphProviderRefreshEvent extends Event {
  static eventName = "graphproviderrefresh";

  constructor(
    public readonly providerName: string,
    public readonly location: string
  ) {
    super(GraphProviderRefreshEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class RunEvent extends Event {
  static eventName = "breadboardrunboard";

  constructor() {
    super(RunEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export enum ToastType {
  INFORMATION = "information",
  WARNING = "warning",
  ERROR = "error",
}

export class ToastEvent extends Event {
  static eventName = "breadboardtoast";

  constructor(
    public message: string,
    public toastType: ToastType
  ) {
    super(ToastEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class DelayEvent extends Event {
  static eventName = "breadboarddelay";

  constructor(public duration: number) {
    super(DelayEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class InputRequestedEvent extends Event {
  static eventName = "breadboardinputrequested";

  constructor() {
    super(InputRequestedEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class InputEnterEvent extends Event {
  static eventName = "breadboardinputenter";

  constructor(
    public id: string,
    public data: Record<string, unknown>
  ) {
    super(InputEnterEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class InputErrorEvent extends Event {
  static eventName = "breadboardinputerror";

  constructor(public detail: string) {
    super(InputErrorEvent.eventName, {
      bubbles: true,
    });
  }
}

export class BoardUnloadEvent extends Event {
  static eventName = "breadboardboardunload";

  constructor() {
    super(BoardUnloadEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class MessageTraversalEvent extends Event {
  static eventName = "breadboardmessagetraversal";

  constructor(public index: number) {
    super(MessageTraversalEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class ResumeEvent extends Event {
  static eventName = "breadboardresume";

  constructor() {
    super(ResumeEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class NodeCreateEvent extends Event {
  static eventName = "breadboardnodecreate";

  constructor(
    public readonly id: string,
    public readonly nodeType: string,
    public readonly subGraphId: string | null = null
  ) {
    super(NodeCreateEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class NodeDeleteEvent extends Event {
  static eventName = "breadboardnodedelete";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null
  ) {
    super(NodeDeleteEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class NodeMultiLayoutEvent extends Event {
  static eventName = "breadboardnodemultilayout";

  constructor(
    public readonly layout: Map<string, { x: number; y: number }>,
    public readonly subGraphId: string | null = null
  ) {
    super(NodeMultiLayoutEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class NodeUpdateEvent extends Event {
  static eventName = "breadboardnodeupdate";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null,
    public readonly configuration: NodeConfiguration
  ) {
    super(NodeUpdateEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class EdgeChangeEvent extends Event {
  static eventName = "breadboardedgechange";

  constructor(
    public readonly changeType: "add" | "remove" | "move",
    public readonly from: { from: string; to: string; in: string; out: string },
    public readonly to?: { from: string; to: string; in: string; out: string },
    public readonly subGraphId: string | null = null
  ) {
    super(EdgeChangeEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class NodeMoveEvent extends Event {
  static eventName = "breadboardnodemove";

  constructor(
    public readonly id: string,
    public readonly x: number,
    public readonly y: number,
    public readonly subGraphId: string | null = null
  ) {
    super(NodeMoveEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphNodePositionsCalculatedEvent extends Event {
  static eventName = "breadboardgraphnodepositionscalculated";

  constructor(public readonly layout: Map<string, { x: number; y: number }>) {
    super(GraphNodePositionsCalculatedEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphNodeMoveEvent extends Event {
  static eventName = "breadboardgraphnodemove";

  constructor(
    public readonly id: string,
    public readonly x: number,
    public readonly y: number
  ) {
    super(GraphNodeMoveEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphNodeSelectedEvent extends Event {
  static eventName = "breadboardgraphnodeselected";

  constructor(public id: string | null) {
    super(GraphNodeSelectedEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphNodeEdgeAttachEvent extends Event {
  static eventName = "breadboardgraphedgeattach";

  constructor(public edge: InspectableEdge) {
    super(GraphNodeEdgeAttachEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphNodeEdgeDetachEvent extends Event {
  static eventName = "breadboardgraphedgedetach";

  constructor(public edge: InspectableEdge) {
    super(GraphNodeEdgeDetachEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphNodeEdgeChangeEvent extends Event {
  static eventName = "breadboardgraphedgechange";

  constructor(
    public fromEdge: InspectableEdge,
    public toEdge: InspectableEdge
  ) {
    super(GraphNodeEdgeChangeEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphNodeDeleteEvent extends Event {
  static eventName = "breadboardgraphnodedelete";

  constructor(public id: string) {
    super(GraphNodeDeleteEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class SchemaChangeEvent extends Event {
  static eventName = "breadboardschemachange";

  constructor() {
    super(SchemaChangeEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}
