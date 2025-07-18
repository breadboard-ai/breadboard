/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphIdentifier,
  GraphMetadata,
  LLMContent,
  NodeIdentifier,
  NodeValue,
} from "@breadboard-ai/types";
import type {
  GraphDescriptor,
  InspectablePort,
  PortIdentifier,
  Schema,
} from "@google-labs/breadboard";
import type {
  AppTemplateAdditionalOptionsAvailable,
  Command,
  EdgeData,
  Settings,
  TopGraphEdgeInfo,
  UserOutputValues,
  Utterance,
  WorkspaceVisualChangeId,
  SnackType,
  SnackbarAction,
  SnackbarUUID,
} from "../types/types.js";

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

/** State Event System */

import type * as Board from "./board/board.js";
import type * as Host from "./host/host.js";
import type * as Node from "./node/node.js";
import type * as Asset from "./asset/asset.js";
import type * as Theme from "./theme/theme.js";
import { BaseEventDetail } from "./base.js";

type EnforceEventTypeMatch<T extends Record<string, BaseEventDetail<string>>> =
  {
    [K in keyof T]: T[K] extends BaseEventDetail<infer EventType>
      ? EventType extends K
        ? T[K]
        : never
      : never;
  };

export type StateEventDetailMap = EnforceEventTypeMatch<{
  "board.create": Board.Create;
  "board.delete": Board.Delete;
  "board.input": Board.Input;
  "board.load": Board.Load;
  "board.remix": Board.Remix;
  "board.rename": Board.Rename;
  "board.run": Board.Run;
  "board.stop": Board.Stop;
  "board.replace": Board.Replace;

  "host.modetoggle": Host.ModeToggle;
  "host.selectionstatechange": Host.SelectionStateChange;
  "host.lock": Host.Lock;
  "host.unlock": Host.Unlock;
  "host.flagchange": Host.FlagChange;

  "node.addwithedge": Node.AddWithEdge;
  "node.change": Node.Change;
  "node.multichange": Node.MultiChange;
  "node.changeedge": Node.ChangeEdge;
  "node.changeedgeattachmentpoint": Node.ChangeEdgeAttachmentPoint;

  "asset.changeedge": Asset.ChangeEdge;
  "asset.add": Asset.Add;

  "theme.create": Theme.Create;
  "theme.change": Theme.Change;
  "theme.delete": Theme.Delete;
  "theme.update": Theme.Update;
}>;

export class StateEvent<
  T extends keyof StateEventDetailMap,
> extends CustomEvent<StateEventDetailMap[T]> {
  static eventName = "bbevent";

  constructor(readonly payload: StateEventDetailMap[T]) {
    super(StateEvent.eventName, { detail: payload, ...eventInit });
  }
}

/** Legacy Event System */

/**
 * Board Management
 */

export class CloseEvent extends Event {
  static eventName = "bbclose";

  constructor() {
    super(CloseEvent.eventName, { ...eventInit });
  }
}

export class ShareRequestedEvent extends Event {
  static eventName = "bbsharerequested";

  constructor() {
    super(ShareRequestedEvent.eventName, { ...eventInit });
  }
}

export class ContinueEvent extends Event {
  static eventName = "bbcontinue";

  constructor() {
    super(ContinueEvent.eventName, { ...eventInit });
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

export class ZoomInEvent extends Event {
  static eventName = "bbzoomin";
  constructor(public readonly animate = true) {
    super(ZoomInEvent.eventName, { ...eventInit });
  }
}

export class ZoomOutEvent extends Event {
  static eventName = "bbzoomout";
  constructor(public readonly animate = true) {
    super(ZoomOutEvent.eventName, { ...eventInit });
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

export class ModalDismissedEvent extends Event {
  static eventName = "bbmodaldismissed";

  constructor(public readonly withSave = false) {
    super(ModalDismissedEvent.eventName, { ...eventInit });
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

export class SnackbarEvent extends Event {
  static eventName = "bbsnackbar" as const;

  constructor(
    public readonly snackbarId = globalThis.crypto.randomUUID(),
    public readonly message: string,
    public readonly snackType: SnackType,
    public readonly actions: SnackbarAction[] = [],
    public readonly persistent = false,
    public readonly replaceAll = false
  ) {
    super(SnackbarEvent.eventName, { ...eventInit });
  }
}

export class UnsnackbarEvent extends Event {
  static eventName = "bbunsnackbar";

  constructor(public readonly snackbarId?: SnackbarUUID) {
    super(UnsnackbarEvent.eventName, { ...eventInit });
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

  constructor(
    public readonly assetType: string,
    public readonly allowedMimeTypes: string | null = null
  ) {
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

/** Snackbar */

export class SnackbarActionEvent extends Event {
  static eventName = "bbsnackbaraction";

  constructor(
    public readonly action: string,
    public readonly value?: string
  ) {
    super(SnackbarActionEvent.eventName, { ...eventInit });
  }
}

/** Iterate on prompt button press. */

export class IterateOnPromptEvent extends Event {
  static eventName = "bbiterateonprompt";

  constructor(
    public readonly title: string,
    public readonly promptTemplate: string,
    public readonly boardId: string,
    public readonly nodeId: string,
    public readonly modelId: string | null
  ) {
    super(IterateOnPromptEvent.eventName, { ...eventInit });
  }
}

/** Floating Input */

export class ResizeEvent extends Event {
  static eventName = "bbresize";

  constructor(public readonly contentRect: DOMRect) {
    super(ResizeEvent.eventName, { ...eventInit });
  }
}

export class GoogleDrivePickerCloseEvent extends Event {
  static eventName = "bbgoogledrivepickerclose";
  readonly result: google.picker.ResponseObject;

  constructor(result: google.picker.ResponseObject) {
    super(GoogleDrivePickerCloseEvent.eventName, { ...eventInit });
    this.result = result;
  }
}

declare global {
  interface HTMLElementEventMap {
    bbtoast: ToastEvent;
    bbgoogledrivepickerclose: GoogleDrivePickerCloseEvent;
  }
}
