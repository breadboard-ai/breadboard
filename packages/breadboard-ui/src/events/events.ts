/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type InspectableEdge,
  type NodeConfiguration,
} from "@google-labs/breadboard";

export class StartEvent extends Event {
  static eventName = "breadboardstart";

  constructor(public url: string) {
    super(StartEvent.eventName, {
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
