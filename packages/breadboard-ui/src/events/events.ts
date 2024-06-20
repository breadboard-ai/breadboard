/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditSpec,
  GraphDescriptor,
  InspectableEdge,
  NodeConfiguration,
  NodeDescriptor,
} from "@google-labs/breadboard";
import type { Settings } from "../types/types.js";
import type { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export enum ToastType {
  INFORMATION = "information",
  WARNING = "warning",
  ERROR = "error",
  PENDING = "pending",
}

/**
 * Board Management
 */

export class StartEvent extends Event {
  static eventName = "bbstart";

  constructor(
    public readonly url: string | null = null,
    public readonly descriptor: GraphDescriptor | null = null
  ) {
    super(StartEvent.eventName, { ...eventInit });

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

export class RunEvent extends Event {
  static eventName = "bbrunboard";

  constructor() {
    super(RunEvent.eventName, { ...eventInit });
  }
}

export class StopEvent extends Event {
  static eventName = "bbstopboard";

  constructor() {
    super(StopEvent.eventName, { ...eventInit });
  }
}

export class BoardInfoUpdateEvent extends Event {
  static eventName = "bbboardinfoupdate";

  constructor(
    public readonly title: string,
    public readonly version: string,
    public readonly description: string,
    public readonly status: "published" | "draft" | null = null,
    public readonly isTool: boolean | null = null,
    public readonly subGraphId: string | null = null
  ) {
    super(BoardInfoUpdateEvent.eventName, { ...eventInit });
  }
}

export class BoardUnloadEvent extends Event {
  static eventName = "bbboardunload";

  constructor() {
    super(BoardUnloadEvent.eventName, { ...eventInit });
  }
}

/**
 * General UI
 */

export class OverflowMenuActionEvent extends Event {
  static eventName = "bboverflowmenuaction";

  constructor(public readonly action: string) {
    super(OverflowMenuActionEvent.eventName, { ...eventInit });
  }
}

export class OverflowMenuDismissedEvent extends Event {
  static eventName = "bboverflowmenudismissed";

  constructor() {
    super(OverflowMenuDismissedEvent.eventName, { ...eventInit });
  }
}

export class UndoEvent extends Event {
  static eventName = "bbundo";

  constructor() {
    super(UndoEvent.eventName, { ...eventInit });
  }
}

export class RedoEvent extends Event {
  static eventName = "bbredo";

  constructor() {
    super(RedoEvent.eventName, { ...eventInit });
  }
}

export class OverlayDismissedEvent extends Event {
  static eventName = "bboverlaydismissed";

  constructor() {
    super(OverlayDismissedEvent.eventName, { ...eventInit });
  }
}

export class SettingsUpdateEvent extends Event {
  static eventName = "bbsettingsupdate";

  constructor(public readonly settings: Settings) {
    super(SettingsUpdateEvent.eventName, { ...eventInit });
  }
}

export class ToastEvent extends Event {
  static eventName = "bbtoast";

  constructor(
    public readonly message: string,
    public readonly toastType: ToastType
  ) {
    super(ToastEvent.eventName, { ...eventInit });
  }
}

export class DelayEvent extends Event {
  static eventName = "bbdelay";

  constructor(public readonly duration: number) {
    super(DelayEvent.eventName, { ...eventInit });
  }
}

export class InputRequestedEvent extends Event {
  static eventName = "bbinputrequested";

  constructor() {
    super(InputRequestedEvent.eventName, { ...eventInit });
  }
}

export class InputEnterEvent extends Event {
  static eventName = "bbinputenter";

  constructor(
    public readonly id: string,
    public readonly data: Record<string, unknown>,
    public readonly allowSavingIfSecret: boolean
  ) {
    super(InputEnterEvent.eventName, { ...eventInit });
  }
}

export class InputErrorEvent extends Event {
  static eventName = "bbinputerror";

  constructor(public readonly detail: string) {
    super(InputErrorEvent.eventName, { ...eventInit });
  }
}

/**
 * Graph Editing
 */

export class KitNodeChosenEvent extends Event {
  static eventName = "bbkitnodechosen";

  constructor(public readonly nodeType: string) {
    super(KitNodeChosenEvent.eventName, { ...eventInit });
  }
}

/**
 * Sub Graph Management
 */

export class SubGraphChosenEvent extends Event {
  static eventName = "bbsubgraphchosen";

  constructor(public readonly subGraphId: string) {
    super(SubGraphChosenEvent.eventName, { ...eventInit });
  }
}

export class SubGraphDeleteEvent extends Event {
  static eventName = "bbsubgraphdelete";

  constructor(public readonly subGraphId: string) {
    super(SubGraphDeleteEvent.eventName, { ...eventInit });
  }
}

export class SubGraphCreateEvent extends Event {
  static eventName = "bbsubgraphcreate";

  constructor(public readonly subGraphTitle: string) {
    super(SubGraphCreateEvent.eventName, { ...eventInit });
  }
}

/**
 * Graph Providers
 */

export class GraphProviderConnectRequestEvent extends Event {
  static eventName = "bbgraphproviderconnectrequest";

  constructor(
    public readonly providerName: string,
    public readonly location?: string,
    public readonly apiKey?: string
  ) {
    super(GraphProviderConnectRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderDeleteRequestEvent extends Event {
  static eventName = "bbgraphproviderdeleterequest";

  constructor(
    public readonly providerName: string,
    public readonly url: string,
    public readonly isActive: boolean
  ) {
    super(GraphProviderDeleteRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderLoadRequestEvent extends Event {
  static eventName = "bbgraphproviderloadrequest";

  constructor(
    public readonly providerName: string,
    public readonly url: string
  ) {
    super(GraphProviderLoadRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderRenewAccessRequestEvent extends Event {
  static eventName = "bbgraphproviderrenewaccesssrequest";

  constructor(
    public readonly providerName: string,
    public readonly location: string
  ) {
    super(GraphProviderRenewAccessRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderDisconnectEvent extends Event {
  static eventName = "bbgraphproviderdisconnect";

  constructor(
    public readonly providerName: string,
    public readonly location: string
  ) {
    super(GraphProviderDisconnectEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderBlankBoardEvent extends Event {
  static eventName = "bbgraphproviderblankboard";

  constructor() {
    super(GraphProviderBlankBoardEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderSaveBoardEvent extends Event {
  static eventName = "bbgraphprovidersaveboard";

  constructor(
    public readonly providerName: string,
    public readonly location: string,
    public readonly fileName: string,
    public readonly graph: GraphDescriptor
  ) {
    super(GraphProviderSaveBoardEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderRefreshEvent extends Event {
  static eventName = "bbgraphproviderrefresh";

  constructor(
    public readonly providerName: string,
    public readonly location: string
  ) {
    super(GraphProviderRefreshEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderAddEvent extends Event {
  static eventName = "bbgraphprovideradd";

  constructor() {
    super(GraphProviderAddEvent.eventName, { ...eventInit });
  }
}

export class GraphProviderSelectionChangeEvent extends Event {
  static eventName = "bbgraphproviderselectionchange";

  constructor(
    public readonly selectedProvider: string,
    public readonly selectedLocation: string
  ) {
    super(GraphProviderSelectionChangeEvent.eventName, { ...eventInit });
  }
}

/**
 * Graph Management - UI
 */

export class CommentUpdateEvent extends Event {
  static eventName = "bbcommentupdate";

  constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly subGraphId: string | null = null
  ) {
    super(CommentUpdateEvent.eventName, { ...eventInit });
  }
}

export class SchemaChangeEvent extends Event {
  static eventName = "bbschemachange";

  constructor() {
    super(SchemaChangeEvent.eventName, { ...eventInit });
  }
}

export class CodeChangeEvent extends Event {
  static eventName = "bbcodechange";

  constructor() {
    super(CodeChangeEvent.eventName, { ...eventInit });
  }
}

export class NodeCreateEvent extends Event {
  static eventName = "bbnodecreate";

  constructor(
    public readonly id: string,
    public readonly nodeType: string,
    public readonly subGraphId: string | null = null,
    public readonly configuration: NodeConfiguration | null = null,
    public readonly metadata: NodeMetadata | null = null
  ) {
    super(NodeCreateEvent.eventName, { ...eventInit });
  }
}

export class NodeDeleteEvent extends Event {
  static eventName = "bbnodedelete";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null
  ) {
    super(NodeDeleteEvent.eventName, { ...eventInit });
  }
}

export class NodeUpdateEvent extends Event {
  static eventName = "bbnodeupdate";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null,
    public readonly configuration: NodeConfiguration
  ) {
    super(NodeUpdateEvent.eventName, { ...eventInit });
  }
}

export class NodeMetadataUpdateEvent extends Event {
  static eventName = "bbnodemetadataupdate";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null,
    public readonly metadata: NodeDescriptor["metadata"]
  ) {
    super(NodeMetadataUpdateEvent.eventName, { ...eventInit });
  }
}

export class EdgeChangeEvent extends Event {
  static eventName = "bbedgechange";

  constructor(
    public readonly changeType: "add" | "remove" | "move",
    public readonly from: {
      from: string;
      to: string;
      in: string;
      out: string;
      constant?: boolean;
    },
    public readonly to?: {
      from: string;
      to: string;
      in: string;
      out: string;
      constant?: boolean;
    },
    public readonly subGraphId: string | null = null
  ) {
    super(EdgeChangeEvent.eventName, { ...eventInit });
  }
}

export class MultiEditEvent extends Event {
  static eventName = "bbmultiedit";
  constructor(
    public readonly edits: EditSpec[],
    public readonly description: string,
    public readonly subGraphId: string | null = null
  ) {
    super(MultiEditEvent.eventName, { ...eventInit });
  }
}

export class GraphNodesVisualUpdateEvent extends Event {
  static eventName = "bbgraphnodesmove";

  constructor(
    public readonly nodes: Array<{
      readonly id: string;
      readonly type: "node" | "comment";
      readonly x: number;
      readonly y: number;
      readonly collapsed: boolean;
    }>
  ) {
    super(GraphNodesVisualUpdateEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeSelectedEvent extends Event {
  static eventName = "bbgraphnodeselected";

  constructor(public readonly id: string | null) {
    super(GraphNodeSelectedEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeDeselectedEvent extends Event {
  static eventName = "bbgraphnodedeselected";

  constructor(public readonly id: string | null) {
    super(GraphNodeDeselectedEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeDeselectedAllEvent extends Event {
  static eventName = "bbgraphnodedeselectedall";

  constructor() {
    super(GraphNodeDeselectedAllEvent.eventName, { ...eventInit });
  }
}

export class GraphInitialDrawEvent extends Event {
  static eventName = "bbgraphinitialdraw";

  constructor() {
    super(GraphInitialDrawEvent.eventName, { ...eventInit });
  }
}

export class GraphEdgeAttachEvent extends Event {
  static eventName = "bbgraphedgeattach";

  constructor(public readonly edge: InspectableEdge) {
    super(GraphEdgeAttachEvent.eventName, { ...eventInit });
  }
}

export class GraphEdgeDetachEvent extends Event {
  static eventName = "bbgraphedgedetach";

  constructor(public readonly edge: InspectableEdge) {
    super(GraphEdgeDetachEvent.eventName, { ...eventInit });
  }
}

export class GraphEntityRemoveEvent extends Event {
  static eventName = "bbgraphentityremove";

  constructor(
    public readonly nodes: string[],
    public readonly edges: InspectableEdge[],
    public readonly comments: string[]
  ) {
    super(GraphEntityRemoveEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeEdgeChangeEvent extends Event {
  static eventName = "bbgraphedgechange";

  constructor(
    public readonly fromEdge: InspectableEdge,
    public readonly toEdge: InspectableEdge,
    public readonly constant = false
  ) {
    super(GraphNodeEdgeChangeEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeDeleteEvent extends Event {
  static eventName = "bbgraphnodedelete";

  constructor(public readonly id: string) {
    super(GraphNodeDeleteEvent.eventName, { ...eventInit });
  }
}
