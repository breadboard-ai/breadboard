/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditSpec,
  GraphDescriptor,
  InspectablePort,
  NodeConfiguration,
  NodeDescriptor,
  PortIdentifier,
  Schema,
} from "@google-labs/breadboard";
import type {
  Command,
  EdgeData,
  Settings,
  TopGraphEdgeInfo,
  UserOutputValues,
  WorkspaceSelectionState,
  WorkspaceSelectionChangeId,
  WorkspaceVisualChangeId,
  WorkspaceVisualState,
} from "../types/types.js";
import type {
  GraphIdentifier,
  GraphMetadata,
  ModuleCode,
  ModuleIdentifier,
  ModuleLanguage,
  ModuleMetadata,
  NodeIdentifier,
  NodeMetadata,
  NodeValue,
} from "@breadboard-ai/types";
import { ComponentExpansionState } from "../elements/editor/types.js";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

type MoveToSelection = "immediate" | "animated" | false;

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

export class SaveEvent extends Event {
  static eventName = "bbsave";

  constructor() {
    super(SaveEvent.eventName, { ...eventInit });
  }
}

export class SaveAsEvent extends Event {
  static eventName = "bbsaveas";

  constructor() {
    super(SaveAsEvent.eventName, { ...eventInit });
  }
}

export class BoardInfoUpdateEvent extends Event {
  static eventName = "bbboardinfoupdate";

  constructor(
    public readonly tabId: string | null,
    public readonly title: string,
    public readonly version: string,
    public readonly description: string,
    public readonly status: "published" | "draft" | null = null,
    public readonly isTool: boolean | null = null,
    public readonly isComponent: boolean | null = null,
    public readonly subGraphId: string | null = null
  ) {
    super(BoardInfoUpdateEvent.eventName, { ...eventInit });
  }
}

/**
 * Run Management
 */

export class RunDownloadEvent extends Event {
  static eventName = "bbrundownload";

  constructor() {
    super(RunDownloadEvent.eventName, { ...eventInit });
  }
}

/**
 * Enhancement
 */

export class EnhanceNodeConfigurationEvent extends Event {
  static eventName = "bbenhancenodeconfiguration";

  constructor(
    public readonly id: string,
    public readonly property: string,
    public readonly value: NodeValue
  ) {
    super(EnhanceNodeConfigurationEvent.eventName, { ...eventInit });
  }
}

export class EnhanceNodeResetEvent extends Event {
  static eventName = "bbenhancenodereset";

  constructor(public readonly id: string) {
    super(EnhanceNodeResetEvent.eventName, { ...eventInit });
  }
}

/**
 * General UI
 */

export class ShowTooltipEvent extends Event {
  static eventName = "bbshowtooltip";
  constructor(
    public readonly message: string,
    public readonly x: number,
    public readonly y: number
  ) {
    super(ShowTooltipEvent.eventName, { ...eventInit });
  }
}

export class ToggleBoardActivityEvent extends Event {
  static eventName = "bbtoggleboardactivity";
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly forceOn = false
  ) {
    super(ToggleBoardActivityEvent.eventName, { ...eventInit });
  }
}

export class ZoomToFitEvent extends Event {
  static eventName = "bbzoomtofit";
  constructor() {
    super(ZoomToFitEvent.eventName, { ...eventInit });
  }
}

export class ToggleFollowEvent extends Event {
  static eventName = "bbtogglefollow";
  constructor() {
    super(ToggleFollowEvent.eventName, { ...eventInit });
  }
}

export class ResetLayoutEvent extends Event {
  static eventName = "bbresetlayout";
  constructor() {
    super(ResetLayoutEvent.eventName, { ...eventInit });
  }
}

export class HideTooltipEvent extends Event {
  static eventName = "bbhidetooltip";
  constructor() {
    super(HideTooltipEvent.eventName, { ...eventInit });
  }
}

export class ResetEvent extends Event {
  static eventName = "bbreset";
  constructor() {
    super(ResetEvent.eventName, { ...eventInit });
  }
}

export class OverflowMenuActionEvent extends Event {
  static eventName = "bboverflowmenuaction";

  constructor(
    public readonly action: string,
    public readonly value: string | null = null,
    public readonly x: number | null = null,
    public readonly y: number | null = null
  ) {
    super(OverflowMenuActionEvent.eventName, { ...eventInit });
  }
}

export class OverflowMenuSecondaryActionEvent extends Event {
  static eventName = "bboverflowmenusecondaryaction";

  constructor(
    public readonly action: string,
    public readonly value?: unknown
  ) {
    super(OverflowMenuSecondaryActionEvent.eventName, { ...eventInit });
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

export class ToastRemovedEvent extends Event {
  static eventName = "bbtoastremoved";

  constructor(public readonly toastId: string) {
    super(ToastRemovedEvent.eventName, { ...eventInit });
  }
}

export class DelayEvent extends Event {
  static eventName = "bbdelay";

  constructor(public readonly duration: number) {
    super(DelayEvent.eventName, { ...eventInit });
  }
}

export class DragConnectorStartEvent extends Event {
  static eventName = "bbdragconnectorstart";

  constructor(
    public readonly location: { x: number; y: number },
    public readonly graphId: GraphIdentifier
  ) {
    super(DragConnectorStartEvent.eventName, { ...eventInit });
  }
}

export class DragConnectorCancelledEvent extends Event {
  static eventName = "bbdragconnectorcancelled";

  constructor() {
    super(DragConnectorCancelledEvent.eventName, { ...eventInit });
  }
}
/**
 * @deprecated
 */
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

export class PersistToggleEvent extends Event {
  static eventName = "bbpersisttoggle";

  constructor() {
    super(PersistToggleEvent.eventName, { ...eventInit });
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
 * Workspace management
 */

export class WorkspaceSelectionMoveEvent extends Event {
  static eventName = "bbworkspaceselectionmove";
  constructor(
    public readonly selections: WorkspaceSelectionState,
    public readonly targetGraphId: GraphIdentifier | null,
    public readonly delta: { x: number; y: number }
  ) {
    super(WorkspaceSelectionMoveEvent.eventName, { ...eventInit });
  }
}

export class WorkspaceVisualUpdateEvent extends Event {
  static eventName = "bbworkspacevisualupdate";
  constructor(
    public readonly visualChangeId: WorkspaceVisualChangeId,
    public readonly visualState: WorkspaceVisualState
  ) {
    super(WorkspaceVisualUpdateEvent.eventName, { ...eventInit });
  }
}

export class WorkspaceSelectionStateEvent extends Event {
  static eventName = "bbworkspaceselectionstate";

  constructor(
    public readonly selectionChangeId: WorkspaceSelectionChangeId,
    public readonly selections: WorkspaceSelectionState | null,
    public readonly replaceExistingSelections = true,
    public readonly moveToSelection: MoveToSelection = false
  ) {
    super(WorkspaceSelectionStateEvent.eventName, { ...eventInit });
  }
}

export class WorkspaceNewItemCreateRequestEvent extends Event {
  static eventName = "bbworkspacenewitemcreaterequest";

  constructor() {
    super(WorkspaceNewItemCreateRequestEvent.eventName, { ...eventInit });
  }
}

export class WorkspaceItemCreateEvent extends Event {
  static eventName = "bbworkspaceitemcreate";

  constructor(
    public readonly itemType: "declarative" | "imperative",
    public readonly title: string | null = null
  ) {
    super(WorkspaceItemCreateEvent.eventName, { ...eventInit });
  }
}

export class WorkspaceItemVisualUpdateEvent extends Event {
  static eventName = "bbworkspaceitemvisualupdate";

  constructor(
    public readonly visualChangeId: WorkspaceVisualChangeId,
    public readonly graphId: GraphIdentifier,
    public readonly visual: GraphMetadata["visual"]
  ) {
    super(WorkspaceItemVisualUpdateEvent.eventName, { ...eventInit });
  }
}

/**
 * Sub Graph Management
 */

export class SubGraphChosenEvent extends Event {
  static eventName = "bbsubgraphchosen";

  constructor(
    public readonly subGraphId: string,
    public readonly zoomToNode: NodeIdentifier | null = null
  ) {
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
 * Module Management
 */

export class FormatModuleCodeEvent extends Event {
  static readonly eventName = "bbformatmodulecode";

  constructor() {
    super(FormatModuleCodeEvent.eventName, { ...eventInit });
  }
}

export class ToggleModulePreviewEvent extends Event {
  static readonly eventName = "bbtogglepreview";

  constructor() {
    super(ToggleModulePreviewEvent.eventName, { ...eventInit });
  }
}

export class ModuleChosenEvent extends Event {
  static eventName = "bbmodulechosen";

  constructor(public readonly moduleId: ModuleIdentifier | null) {
    super(ModuleChosenEvent.eventName, { ...eventInit });
  }
}

export class ModuleChangeLanguageEvent extends Event {
  static eventName = "bbmodulechangelanguage";

  constructor(
    public readonly moduleId: ModuleIdentifier,
    public readonly moduleLanguage: ModuleLanguage
  ) {
    super(ModuleChangeLanguageEvent.eventName, { ...eventInit });
  }
}

export class ModuleEditEvent extends Event {
  static eventName = "bbmoduleedit";

  constructor(
    public readonly moduleId: ModuleIdentifier,
    public readonly code: ModuleCode,
    public readonly metadata: ModuleMetadata
  ) {
    super(ModuleEditEvent.eventName, { ...eventInit });
  }
}

export class ModuleDeleteEvent extends Event {
  static eventName = "bbmoduledelete";

  constructor(public readonly moduleId: ModuleIdentifier) {
    super(ModuleDeleteEvent.eventName, { ...eventInit });
  }
}

export class ModuleCreateEvent extends Event {
  static eventName = "bbmodulecreate";

  constructor(public readonly moduleId: ModuleIdentifier) {
    super(ModuleCreateEvent.eventName, { ...eventInit });
  }
}

/**
 * Board Servers
 */

export class GraphBoardOpenRequestEvent extends Event {
  static eventName = "bbgraphboardopenrequest";

  constructor() {
    super(GraphBoardOpenRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerConnectRequestEvent extends Event {
  static eventName = "bbgraphboardserverconnectrequest";

  constructor(
    public readonly boardServerName: string,
    public readonly location?: string,
    public readonly apiKey?: string
  ) {
    super(GraphBoardServerConnectRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerDeleteRequestEvent extends Event {
  static eventName = "bbgraphboardserverdeleterequest";

  constructor(
    public readonly boardServerName: string,
    public readonly url: string,
    public readonly isActive: boolean
  ) {
    super(GraphBoardServerDeleteRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerLoadRequestEvent extends Event {
  static eventName = "bbgraphboardserverloadrequest";

  constructor(
    public readonly boardServerName: string,
    public readonly url: string,
    public readonly newTab = false
  ) {
    super(GraphBoardServerLoadRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerRenewAccessRequestEvent extends Event {
  static eventName = "bbgraphboardserverrenewaccesssrequest";

  constructor(
    public readonly boardServerName: string,
    public readonly location: string
  ) {
    super(GraphBoardServerRenewAccessRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerDisconnectEvent extends Event {
  static eventName = "bbgraphboardserverdisconnect";

  constructor(
    public readonly boardServerName: string,
    public readonly location: string
  ) {
    super(GraphBoardServerDisconnectEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerBlankBoardEvent extends Event {
  static eventName = "bbgraphboardserverblankboard";

  constructor() {
    super(GraphBoardServerBlankBoardEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerSaveBoardEvent extends Event {
  static eventName = "bbgraphboardserversaveboard";

  constructor(
    public readonly boardServerName: string,
    public readonly location: string,
    public readonly fileName: string,
    public readonly graph: GraphDescriptor
  ) {
    super(GraphBoardServerSaveBoardEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerRefreshEvent extends Event {
  static eventName = "bbgraphboardserverrefresh";

  constructor(
    public readonly boardServerName: string,
    public readonly location: string
  ) {
    super(GraphBoardServerRefreshEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerAddEvent extends Event {
  static eventName = "bbgraphboardserveradd";

  constructor() {
    super(GraphBoardServerAddEvent.eventName, { ...eventInit });
  }
}

export class GraphBoardServerSelectionChangeEvent extends Event {
  static eventName = "bbgraphboardserverselectionchange";

  constructor(
    public readonly selectedBoardServer: string,
    public readonly selectedLocation: string
  ) {
    super(GraphBoardServerSelectionChangeEvent.eventName, { ...eventInit });
  }
}

/**
 * Graph Management - UI
 */

export class BoardItemCopyEvent extends Event {
  static eventName = "bbboarditemcopy";

  constructor(
    public readonly id: GraphIdentifier | ModuleIdentifier,
    public readonly itemType: "graph" | "module",
    public readonly title: string
  ) {
    super(BoardItemCopyEvent.eventName, { ...eventInit });
  }
}

export class OutlineModeChangeEvent extends Event {
  static eventName = "bboutlinemodechange";

  constructor(public readonly mode: "list" | "tree") {
    super(OutlineModeChangeEvent.eventName, { ...eventInit });
  }
}

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

export class CodeChangeEvent extends Event {
  static eventName = "bbcodechange";

  constructor(
    public readonly options: {
      manual?: boolean;
      format?: boolean;
      errors?: number;
      errorsDetail?: Array<{ message: string; start: number }>;
    }
  ) {
    super(CodeChangeEvent.eventName, { ...eventInit });
  }
}

export class UserOutputEvent extends Event {
  static eventName = "bbuseroutput";

  constructor(public readonly values: UserOutputValues) {
    super(UserOutputEvent.eventName, { ...eventInit });
  }
}

export class NodeCreateReferenceEvent extends Event {
  static eventName = "bbnodecreatereference";

  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly nodeId: NodeIdentifier,
    public readonly portId: PortIdentifier,
    public readonly value: string
  ) {
    super(NodeCreateReferenceEvent.eventName, { ...eventInit });
  }
}

export class NodeDeleteReferenceEvent extends Event {
  static eventName = "bbnodedeletereference";

  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly nodeId: NodeIdentifier,
    public readonly portId: PortIdentifier
  ) {
    super(NodeDeleteReferenceEvent.eventName, { ...eventInit });
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

export class NodePartialUpdateEvent extends Event {
  static eventName = "bbnodepartialupdate";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null,
    public readonly configuration: NodeConfiguration,
    public readonly metadata: NodeMetadata | null = null,
    public readonly debugging = false
  ) {
    super(NodePartialUpdateEvent.eventName, { ...eventInit });
  }
}

export class BoardChosenEvent extends Event {
  static eventName = "bbboardchosen";

  constructor(public readonly id: GraphIdentifier) {
    super(BoardChosenEvent.eventName, { ...eventInit });
  }
}

export class EdgeValueUpdateEvent extends Event {
  static eventName = "bbedgevalueupdate";

  constructor(
    public readonly id: string,
    public readonly value: NodeValue
  ) {
    super(EdgeValueUpdateEvent.eventName, { ...eventInit });
  }
}

export class RunIsolatedNodeEvent extends Event {
  static eventName = "bbrunisolatednode";

  constructor(
    public readonly id: string,
    public readonly stopAfter = true
  ) {
    super(RunIsolatedNodeEvent.eventName, { ...eventInit });
  }
}

export class NodeConfigurationUpdateRequestEvent extends Event {
  static eventName = "bbnodeconfigurationupdaterequest";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null,
    public readonly port: InspectablePort | null = null,
    public readonly selectedPort: string | null,
    public readonly x: number = 0,
    public readonly y: number = 0,
    public readonly addHorizontalClickClearance = true
  ) {
    super(NodeConfigurationUpdateRequestEvent.eventName, { ...eventInit });
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

export class NodeTypeRetrievalErrorEvent extends Event {
  static eventName = "bbnodetyperetrievalerror";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null
  ) {
    super(NodeTypeRetrievalErrorEvent.eventName, { ...eventInit });
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

export class EdgeValueSelectedEvent extends Event {
  static eventName = "bbedgevalueselected";

  constructor(
    public readonly info: TopGraphEdgeInfo[],
    public readonly schema: Schema | null,
    public readonly edge: EdgeData | null,
    public readonly x: number,
    public readonly y: number
  ) {
    super(EdgeValueSelectedEvent.eventName, { ...eventInit });
  }
}

export class NodeActivitySelectedEvent extends Event {
  static eventName = "bbnodeactivityselected";

  constructor(
    public readonly nodeTitle: string,
    public readonly runId: string
  ) {
    super(NodeActivitySelectedEvent.eventName, { ...eventInit });
  }
}

export class CommentEditRequestEvent extends Event {
  static eventName = "bbcommenteditrequest";

  constructor(
    public readonly id: string,
    public readonly x: number,
    public readonly y: number,
    public readonly subGraphId: string | null = null
  ) {
    super(CommentEditRequestEvent.eventName, { ...eventInit });
  }
}

export class NodeRunRequestEvent extends Event {
  static eventName = "bbnoderunrequest";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null
  ) {
    super(NodeRunRequestEvent.eventName, { ...eventInit });
  }
}

export class InteractionEvent extends Event {
  static eventName = "bbinteraction";

  constructor() {
    super(InteractionEvent.eventName, { ...eventInit });
  }
}

export class GraphInteractionEvent extends Event {
  static eventName = "bbgraphinteraction";

  constructor() {
    super(GraphInteractionEvent.eventName, { ...eventInit });
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
      readonly expansionState: ComponentExpansionState;
    }>,
    public readonly subGraphId: string | null
  ) {
    super(GraphNodesVisualUpdateEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeEditEvent extends Event {
  static eventName = "bbgraphnodeedit";

  constructor(
    public readonly id: string,
    public readonly port: InspectablePort | null,
    public readonly selectedPort: string | null,
    public readonly x: number,
    public readonly y: number,
    public readonly subGraphId: string | null = null,
    public readonly addHorizontalClickClearance = true
  ) {
    super(GraphNodeEditEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeSelectedEvent extends Event {
  static eventName = "bbgraphnodeselected";

  constructor(
    public readonly id: string | null,
    public readonly subGraphId: string | null
  ) {
    super(GraphNodeSelectedEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeDeselectedEvent extends Event {
  static eventName = "bbgraphnodedeselected";

  constructor(
    public readonly id: string | null,
    public readonly subGraphId: string | null
  ) {
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

  constructor(public readonly subGraphId: string | null) {
    super(GraphInitialDrawEvent.eventName, { ...eventInit });
  }
}

export class GraphEdgeValueSelectedEvent extends Event {
  static eventName = "bbgraphedgevalueselected";

  constructor(
    public readonly info: TopGraphEdgeInfo[],
    public readonly schema: Schema | null,
    public readonly edge: EdgeData | null,
    public readonly x: number,
    public readonly y: number,
    public readonly subGraphId: string | null
  ) {
    super(GraphEdgeValueSelectedEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeActivitySelectedEvent extends Event {
  static eventName = "bbgraphnodeactivityselected";

  constructor(
    public readonly nodeTitle: string,
    public readonly runId: string
  ) {
    super(GraphNodeActivitySelectedEvent.eventName, { ...eventInit });
  }
}

export class GraphEdgeAttachEvent extends Event {
  static eventName = "bbgraphedgeattach";

  constructor(
    public readonly edge: EdgeData,
    public readonly subGraphId: string | null
  ) {
    super(GraphEdgeAttachEvent.eventName, { ...eventInit });
  }
}

export class GraphEdgeDetachEvent extends Event {
  static eventName = "bbgraphedgedetach";

  constructor(
    public readonly edge: EdgeData,
    public readonly subGraphId: string | null
  ) {
    super(GraphEdgeDetachEvent.eventName, { ...eventInit });
  }
}

export class GraphEntityRemoveEvent extends Event {
  static eventName = "bbgraphentityremove";

  constructor(
    public readonly nodes: string[],
    public readonly edges: EdgeData[],
    public readonly comments: string[],
    public readonly subGraphId: string | null
  ) {
    super(GraphEntityRemoveEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeEdgeChangeEvent extends Event {
  static eventName = "bbgraphedgechange";

  constructor(
    public readonly fromEdge: EdgeData,
    public readonly toEdge: EdgeData,
    public readonly constant = false,
    public readonly subGraphId: string | null
  ) {
    super(GraphNodeEdgeChangeEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeDeleteEvent extends Event {
  static eventName = "bbgraphnodedelete";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null
  ) {
    super(GraphNodeDeleteEvent.eventName, { ...eventInit });
  }
}

export class GraphShowTooltipEvent extends Event {
  static eventName = "bbgraphshowtooltip";

  constructor(
    public readonly message: string,
    public readonly x: number,
    public readonly y: number
  ) {
    super(GraphShowTooltipEvent.eventName, { ...eventInit });
  }
}

export class GraphHideTooltipEvent extends Event {
  static eventName = "bbgraphhidetooltip";

  constructor() {
    super(GraphHideTooltipEvent.eventName, { ...eventInit });
  }
}

export class GraphCommentEditRequestEvent extends Event {
  static eventName = "bbgraphcommenteditrequest";

  constructor(
    public readonly id: string,
    public readonly x: number,
    public readonly y: number,
    public readonly subGraphId: string | null = null
  ) {
    super(GraphCommentEditRequestEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeRunRequestEvent extends Event {
  static eventName = "bbgraphnoderunrequest";

  constructor(
    public readonly id: string,
    public readonly subGraphId: string | null = null
  ) {
    super(GraphNodeRunRequestEvent.eventName, { ...eventInit });
  }
}

export class EditorPointerPositionChangeEvent extends Event {
  static eventName = "bbeditorpositionchange";

  constructor(
    public readonly x: number,
    public readonly y: number
  ) {
    super(EditorPointerPositionChangeEvent.eventName, { ...eventInit });
  }
}

/** Connections */

export class ConnectionSignedOutEvent extends Event {
  static eventName = "bbconnectionsignedout";

  constructor(public readonly connectionId: string) {
    super(ConnectionSignedOutEvent.eventName, { ...eventInit });
  }
}

export class GoogleDriveFolderPickedEvent extends Event {
  static eventName = "bbgoogledrivefolderpicked";

  constructor(public readonly id: string | null) {
    super(GoogleDriveFolderPickedEvent.eventName, { ...eventInit });
  }
}

/**
 * Command Palette
 */

export class PaletteDismissedEvent extends Event {
  static eventName = "bbpalettedismissed";

  constructor() {
    super(PaletteDismissedEvent.eventName, { ...eventInit });
  }
}

export class CommandEvent extends Event {
  static eventName = "bbcommand";

  constructor(
    public readonly command: string,
    public readonly secondaryAction: string | null
  ) {
    super(CommandEvent.eventName, { ...eventInit });
  }
}

export class CommandsSetSwitchEvent extends Event {
  static eventName = "bbcommandssetswitch";

  constructor(public readonly namespace: string) {
    super(CommandsSetSwitchEvent.eventName, { ...eventInit });
  }
}

export class CommandsAvailableEvent extends Event {
  static eventName = "bbcommandsavailable";

  constructor(
    public readonly namespace: string,
    public readonly commands: Command[]
  ) {
    super(CommandsAvailableEvent.eventName, { ...eventInit });
  }
}
