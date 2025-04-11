/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphIdentifier,
  GraphMetadata,
  GraphTheme,
  LLMContent,
  ModuleCode,
  ModuleIdentifier,
  ModuleLanguage,
  ModuleMetadata,
  NodeIdentifier,
  NodeMetadata,
  NodeValue,
} from "@breadboard-ai/types";
import type {
  EditHistoryCreator,
  EditSpec,
  GraphDescriptor,
  InspectablePort,
  NodeConfiguration,
  NodeDescriptor,
  PortIdentifier,
  Schema,
  TemplatePart,
} from "@google-labs/breadboard";
import type {
  AppTemplateAdditionalOptionsAvailable,
  AppTheme,
  AssetEdge,
  Command,
  DroppedAsset,
  EdgeAttachmentPoint,
  EdgeData,
  Settings,
  TopGraphEdgeInfo,
  UserOutputValues,
  Utterance,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
  WorkspaceVisualChangeId,
  WorkspaceVisualState,
} from "../types/types.js";

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
    public readonly descriptor: GraphDescriptor | null = null,
    public readonly creator: EditHistoryCreator | null = null
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
  static eventName = "bbrun";

  constructor() {
    super(RunEvent.eventName, { ...eventInit });
  }
}

export class StopEvent extends Event {
  static eventName = "bbstop";

  constructor(public readonly clearLastRun = false) {
    super(StopEvent.eventName, { ...eventInit });
  }
}

export class ContinueEvent extends Event {
  static eventName = "bbcontinue";

  constructor() {
    super(ContinueEvent.eventName, { ...eventInit });
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

export class BoardTitleUpdateEvent extends Event {
  static eventName = "bbboardtitleupdate";

  constructor(public readonly title: string) {
    super(BoardTitleUpdateEvent.eventName, { ...eventInit });
  }
}

export class BoardDescriptionUpdateEvent extends Event {
  static eventName = "bbboarddescriptionupdate";

  constructor(public readonly description: string) {
    super(BoardDescriptionUpdateEvent.eventName, { ...eventInit });
  }
}

export class BoardInfoUpdateEvent extends Event {
  static eventName = "bbboardinfoupdate";

  constructor(
    public readonly tabId: string | null,
    public readonly title: string,
    public readonly version: string,
    public readonly description: string,
    public readonly status: "published" | "draft" | "private" | null = null,
    public readonly isTool: boolean | null = null,
    public readonly isComponent: boolean | null = null,
    public readonly subGraphId: string | null = null,
    public readonly moduleId: string | null = null,
    public readonly exported: boolean | null = null
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
  constructor(public readonly animate = true) {
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
    public readonly connectorType: "node" | "asset",
    public readonly location: DOMPoint
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
 * Exports management
 */

export class ToggleExportEvent extends Event {
  static eventName = "bbtoggleexport";

  constructor(
    public readonly exportId: ModuleIdentifier | GraphIdentifier,
    public readonly exportType: "imperative" | "declarative"
  ) {
    super(ToggleExportEvent.eventName, { ...eventInit });
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

export class GraphBoardServerGeneratedBoardEvent extends Event {
  static eventName = "bbgraphboardservergeneratedboard";

  constructor(
    public readonly graph: GraphDescriptor,
    public readonly creator: EditHistoryCreator
  ) {
    super(GraphBoardServerGeneratedBoardEvent.eventName, { ...eventInit });
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
    public readonly metadata: NodeMetadata | null = null,
    public readonly options: {
      sourceId: NodeIdentifier;
      portId: PortIdentifier;
    } | null = null
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
    public readonly debugging = false,
    public readonly ins: TemplatePart[] | null = null
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
    public readonly addHorizontalClickClearance = true,
    public readonly graphNodeLocation: DOMRect | null = null
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
    public readonly from: Edge,
    public readonly to?: Edge,
    public readonly subGraphId: string | null = null
  ) {
    super(EdgeChangeEvent.eventName, { ...eventInit });
  }
}

export class AssetEdgeChangeEvent extends Event {
  static eventName = "bbassetedgechange";

  constructor(
    public readonly changeType: "add" | "remove",
    public readonly assetEdge: AssetEdge,
    public readonly subGraphId: string | null = null
  ) {
    super(AssetEdgeChangeEvent.eventName, { ...eventInit });
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

export class AddNodeWithEdgeEvent extends Event {
  static eventName = "bbaddnodewithedge";
  constructor(
    public readonly node: NodeDescriptor,
    public readonly edge: Edge,
    public readonly subGraphId: string | null = null
  ) {
    super(AddNodeWithEdgeEvent.eventName, { ...eventInit });
  }
}

export class MoveNodesEvent extends Event {
  static eventName = "bbmovenodes" as const;
  constructor(
    public readonly sourceNodes: Map<GraphIdentifier, NodeIdentifier[]>,
    public readonly destinationGraphId: GraphIdentifier | null = null,
    public readonly positionDelta: DOMPoint | null = null
  ) {
    super(MoveNodesEvent.eventName, { ...eventInit });
  }
}

export class EdgeAttachmentMoveEvent extends Event {
  static eventName = "bbedgeattachmentmove" as const;

  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly edge: Edge,
    public readonly which: "from" | "to",
    public readonly attachmentPoint: EdgeAttachmentPoint
  ) {
    super(EdgeAttachmentMoveEvent.eventName, { ...eventInit });
  }
}

export class DroppedAssetsEvent extends Event {
  static eventName = "bbdroppedassets" as const;
  constructor(public readonly assets: DroppedAsset[]) {
    super(DroppedAssetsEvent.eventName, { ...eventInit });
  }
}

/** @deprecated */
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

export class GraphNodeEditEvent extends Event {
  static eventName = "bbgraphnodeedit";

  constructor(
    public readonly id: string,
    public readonly port: InspectablePort | null,
    public readonly selectedPort: string | null,
    public readonly x: number,
    public readonly y: number,
    public readonly subGraphId: string | null = null,
    public readonly addHorizontalClickClearance = true,
    public readonly graphNodeLocation: DOMRect | null = null
  ) {
    super(GraphNodeEditEvent.eventName, { ...eventInit });
  }
}

export class GraphNodeQuickAddEvent extends Event {
  static eventName = "bbgraphnodequickadd";

  constructor(
    public readonly id: string,
    public readonly portId: string,
    public readonly x: number,
    public readonly y: number,
    public readonly subGraphId: string | null = null,
    public readonly freeDrop = false
  ) {
    super(GraphNodeQuickAddEvent.eventName, { ...eventInit });
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

export class GraphReplaceEvent extends Event {
  static eventName = "bbgraphreplace";

  constructor(
    public readonly replacement: GraphDescriptor,
    public readonly creator: EditHistoryCreator
  ) {
    super(GraphReplaceEvent.eventName, { ...eventInit });
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

/** Components */

export class KitToggleEvent extends Event {
  static eventName = "bbkittoggle";

  constructor(public readonly name: string) {
    super(KitToggleEvent.eventName, { ...eventInit });
  }
}

/** Fast Access Menu events */

export class FastAccessSelectEvent extends Event {
  static eventName = "bbfastaccessselect";

  constructor(
    public readonly path: string,
    public readonly title: string,
    public readonly accessType: "asset" | "tool" | "in" | "param",
    public readonly mimeType?: string,
    public readonly instance?: string
  ) {
    super(FastAccessSelectEvent.eventName, { ...eventInit });
  }
}

export class FastAccessDismissedEvent extends Event {
  static eventName = "bbfastaccessdismissed";

  constructor() {
    super(FastAccessDismissedEvent.eventName, { ...eventInit });
  }
}

export class FastAccessErrorEvent extends Event {
  static eventName = "bbfastaccesserror";

  constructor(public readonly error: string) {
    super(FastAccessErrorEvent.eventName, { ...eventInit });
  }
}

/**
 * Sign In and Out
 */

export class SignInEvent extends Event {
  static eventName = "bbsignin";

  constructor() {
    super(SignInEvent.eventName, { ...eventInit });
  }
}

export class SignInRequestedEvent extends Event {
  static eventName = "bbsigninrequested";

  constructor() {
    super(SignInRequestedEvent.eventName, { ...eventInit });
  }
}

export class SignOutEvent extends Event {
  static eventName = "bbsignout";

  constructor() {
    super(SignOutEvent.eventName, { ...eventInit });
  }
}

/**
 * Themes
 */

export class ThemeChangeEvent extends Event {
  static eventName = "bbthemechange";

  constructor(public readonly theme: string) {
    super(ThemeChangeEvent.eventName, { ...eventInit });
  }
}

export class ThemeCreateEvent extends Event {
  static eventName = "bbthemecreate";

  constructor(public readonly theme: AppTheme) {
    super(ThemeCreateEvent.eventName, { ...eventInit });
  }
}

export class ThemeDeleteEvent extends Event {
  static eventName = "bbthemedelete";

  constructor(public readonly themeId: string) {
    super(ThemeDeleteEvent.eventName, { ...eventInit });
  }
}

export class ThemeUpdateEvent extends Event {
  static eventName = "bbthemeupdate";

  constructor(
    public readonly themeId: string,
    public readonly theme: GraphTheme
  ) {
    super(ThemeUpdateEvent.eventName, { ...eventInit });
  }
}

export class ThemeEditRequestEvent extends Event {
  static eventName = "bbthemeeditrequest";

  constructor(
    public readonly themeOptions: AppTemplateAdditionalOptionsAvailable | null
  ) {
    super(ThemeEditRequestEvent.eventName, { ...eventInit });
  }
}

/** Speech to Text */

export class UtteranceEvent extends Event {
  static eventName = "bbutterance";

  constructor(public readonly parts: Utterance[]) {
    super(UtteranceEvent.eventName, { ...eventInit });
  }
}

/** Assets */

export class ShowAssetOrganizerEvent extends Event {
  static eventName = "bbshowassetorganizer";

  constructor() {
    super(ShowAssetOrganizerEvent.eventName, { ...eventInit });
  }
}

export class AddAssetRequestEvent extends Event {
  static eventName = "bbaddassetrequest";

  constructor(public readonly assetType: string) {
    super(AddAssetRequestEvent.eventName, { ...eventInit });
  }
}

export class AddAssetEvent extends Event {
  static eventName = "bbaddasset";

  constructor(public readonly asset: LLMContent) {
    super(AddAssetEvent.eventName, { ...eventInit });
  }
}

/** Params */

export class ParamCreateEvent extends Event {
  static eventName = "bbparamcreate";

  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly path: string,
    public readonly title: string,
    public readonly description?: string
  ) {
    super(ParamCreateEvent.eventName, { ...eventInit });
  }
}

export class ParamDeleteEvent extends Event {
  static eventName = "bbparamdelete";

  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly path: string
  ) {
    super(ParamDeleteEvent.eventName, { ...eventInit });
  }
}
