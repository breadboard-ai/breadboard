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

export class BlankBoardRequestEvent extends Event {
  static eventName = "breadboardblankboardrequest";

  constructor() {
    super(BlankBoardRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class FileStorageRequestEvent extends Event {
  static eventName = "breadboardfilestoragerequest";

  constructor() {
    super(FileStorageRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class FileStorageDeleteRequestEvent extends Event {
  static eventName = "breadboardfilestoragedeleterequest";

  constructor(
    public readonly location: string,
    public readonly fileName: string,
    public readonly isActive: boolean
  ) {
    super(FileStorageDeleteRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class FileStorageLoadRequestEvent extends Event {
  static eventName = "breadboardfilestorageloadrequest";

  constructor(
    public readonly location: string,
    public readonly fileName: string
  ) {
    super(FileStorageLoadRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class FileStorageRenewAccessRequestEvent extends Event {
  static eventName = "breadboardfilestoragerenewaccesssrequest";

  constructor(public readonly location: string) {
    super(FileStorageRenewAccessRequestEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class FileStorageDisconnectEvent extends Event {
  static eventName = "breadboardfilestoragedisconnect";

  constructor(public readonly location: string) {
    super(FileStorageDisconnectEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class FileStorageBlankBoardEvent extends Event {
  static eventName = "breadboardfileblankboard";

  constructor(
    public readonly location: string,
    public readonly fileName: string
  ) {
    super(FileStorageBlankBoardEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class FileStorageRefreshEvent extends Event {
  static eventName = "breadboardfilestoragerefresh";

  constructor(public readonly location: string) {
    super(FileStorageRefreshEvent.eventName, {
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

export class NodeSelectEvent extends Event {
  static eventName = "breadboardnodeselect";

  constructor(public id: string) {
    super(NodeSelectEvent.eventName, {
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
    public id: string,
    public nodeType: string
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

  constructor(public id: string) {
    super(NodeDeleteEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class NodeMultiLayoutEvent extends Event {
  static eventName = "breadboardnodemultilayout";

  constructor(public layout: Map<string, { x: number; y: number }>) {
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
    public id: string,
    public configuration: NodeConfiguration
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
    public changeType: "add" | "remove" | "move",
    public from: { from: string; to: string; in: string; out: string },
    public to?: { from: string; to: string; in: string; out: string }
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
    public readonly y: number
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
