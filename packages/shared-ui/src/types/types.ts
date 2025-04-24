/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Schema,
  InspectableEdgeType,
  InspectableEdge,
  PortStatus,
  NodeValue,
  NodeConfiguration,
  NodeDescriptor,
  InputValues,
  ErrorResponse,
  GraphDescriptor,
  NodeIdentifier,
  InspectableNodePorts,
  PortIdentifier,
  NodeHandlerMetadata,
  InspectableRun,
  InspectableAssetEdgeDirection,
} from "@google-labs/breadboard";
import {
  AssetPath,
  AssetType,
  CommentNode,
  GraphIdentifier,
  GraphMetadata,
  InlineDataCapabilityPart,
  LLMContent,
  ModuleIdentifier,
  NodeMetadata,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";
import type {
  tsAutocomplete,
  tsFacet,
  tsHover,
  tsLinter,
  tsSync,
} from "@valtown/codemirror-ts";
import { SigninState } from "../utils/signin-adapter";
import { LitElement } from "lit";

export const enum HistoryEventType {
  DONE = "done",
  ERROR = "error",
  INPUT = "input",
  LOAD = "load",
  OUTPUT = "output",
  NODESTART = "nodestart",
  NODEEND = "nodeend",
  SECRETS = "secrets",
  GRAPHSTART = "graphstart",
  GRAPHEND = "graphend",
}

export type InputCallback = (data: Record<string, unknown>) => void;

export type Board = {
  title: string;
  url: string;
  version: string;
};

export enum STATUS {
  RUNNING = "running",
  PAUSED = "paused",
  STOPPED = "stopped",
}

export enum BOARD_LOAD_STATUS {
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
}

export enum BOARD_SAVE_STATUS {
  UNSAVED = "unsaved",
  SAVING = "saving",
  SAVED = "saved",
  ERROR = "error",
}

export type UserInputConfiguration = {
  name: string;
  title: string;
  secret: boolean;
  required?: boolean;
  configured?: boolean;
  value: NodeValue;
  originalValue?: NodeValue;
  schema?: Schema | null;
  status?: PortStatus;
  type?: Schema["type"];
  offer?: {
    enhance?: boolean;
  };
};

export type UserOutputValues = NodeConfiguration;

export interface AllowedLLMContentTypes {
  audioFile: boolean;
  audioMicrophone: boolean;
  videoFile: boolean;
  videoWebcam: boolean;
  imageFile: boolean;
  imageWebcam: boolean;
  imageDrawable: boolean;
  textFile: boolean;
  textInline: boolean;
}

export enum SETTINGS_TYPE {
  SECRETS = "Secrets",
  GENERAL = "General",
  INPUTS = "Inputs",
  NODE_PROXY_SERVERS = "Node Proxy Servers",
  CONNECTIONS = "Connections",
}

export interface SettingEntry {
  key: string;
  value: {
    id?: string;
    name: string;
    description?: string;
    value: string | number | boolean;
  };
}

export interface SettingsList {
  [SETTINGS_TYPE.GENERAL]: SettingEntry;
  [SETTINGS_TYPE.SECRETS]: SettingEntry;
  [SETTINGS_TYPE.INPUTS]: SettingEntry;
  [SETTINGS_TYPE.NODE_PROXY_SERVERS]: SettingEntry;
  [SETTINGS_TYPE.CONNECTIONS]: SettingEntry;
}

export type SettingsItems = Map<
  SettingEntry["value"]["name"],
  SettingEntry["value"]
>;

export type Settings = {
  [K in keyof SettingsList]: {
    configuration: {
      extensible: boolean;
      description: string;
      nameEditable: boolean;
      nameVisible: boolean;
      /**
       * Render an instance of the custom element with this name, instead of
       * generic setting entries. The element must match the
       * {@link CustomSettingsElement} interface.
       */
      customElement?: string;
    };
    items: SettingsItems;
  };
};

export type CustomSettingsElement = HTMLElement & {
  settingsType?: SETTINGS_TYPE | undefined;
  settingsItems?: Settings[SETTINGS_TYPE]["items"] | undefined;
};

/**
 * A simplified interface over {@link SettingsStore} that reads/writes
 * immediately and can be consumed by elements using
 * {@link settingsHelperContext}.
 */
export interface SettingsHelper {
  get(section: SETTINGS_TYPE, name: string): SettingEntry["value"] | undefined;
  set(
    section: SETTINGS_TYPE,
    name: string,
    value: SettingEntry["value"]
  ): Promise<void>;
  delete(section: SETTINGS_TYPE, name: string): Promise<void>;
}

/**
 * A POJO version of {@link InspectableEdge} with only what we need for
 * rendering. An {@link InspectableEdge} should be assignable to this, but not
 * vice-versa.
 *
 * This type was created to distinguish when we have an actual
 * {@link InspectableEdge} with methods and full inspectable nodes, vs a plain
 * object that just has the basic string data.
 *
 * Note that it's not safe to `structuredClone` an {@link InspectableEdge}, so
 * {@link cloneEdgeData} should be used for cloning.
 */
export interface EdgeData {
  from: { descriptor: { id: string; type?: string } };
  to: { descriptor: { id: string; type?: string } };
  out: string;
  in: string;
  type: InspectableEdgeType;
}

({}) as InspectableEdge satisfies EdgeData;

export function cloneEdgeData<T extends EdgeData | null>(edge: T): T {
  return (
    edge === null
      ? null
      : {
          from: {
            descriptor: {
              id: edge.from.descriptor.id,
              type: edge.from.descriptor.type,
            },
          },
          to: {
            descriptor: {
              id: edge.to.descriptor.id,
              type: edge.from.descriptor.type,
            },
          },
          out: edge.out,
          in: edge.in,
          type: edge.type,
        }
  ) as T;
}

export interface RecentBoard {
  title: string;
  url: string;
}

export interface SettingsStore {
  values: Settings;
  getSection(section: SETTINGS_TYPE): Settings[typeof section];
  getItem(section: SETTINGS_TYPE, name: string): void;
  save(settings: Settings): Promise<void>;
  restore(): Promise<void>;
}

export type NodeLogEntry = {
  type: "node";
  id: string;
  descriptor: NodeDescriptor;
  hidden: boolean;
  start: number;
  bubbled: boolean;
  end: number | null;
  activity: ComponentActivityItem[];
  title(): string;
};

export type EdgeLogEntry = {
  type: "edge";
  descriptor?: NodeDescriptor;
  id?: string;
  end: number | null;
  schema?: Schema;
  value?: InputValues;
};

export type ErrorLogEntry = {
  type: "error";
  error: ErrorResponse["error"];
  path: number[];
};

export type LogEntry = NodeLogEntry | EdgeLogEntry | ErrorLogEntry;

export type TopGraphObserverRunStatus = "running" | "paused" | "stopped";

/**
 * The result, returned by the TopGraphObserver.
 */
export type TopGraphRunResult = {
  /**
   * Returns reshuffled log of nodes and edges. The reshuffling is done to
   * make inputs and outputs look like edges, rather than nodes.
   */
  log: LogEntry[];
  /**
   * Returns the current node within the graph. Great for determining the
   * hihglighted node.
   */
  currentNode: ComponentWithActivity | null;
  /**
   * Returns the the current edges values within the graph. Think of this as
   * a map of edge to an array of items. Each item in the array is a value that
   * has travelled across this edge. The most recent value is the last item in
   * the array.
   */
  edgeValues: TopGraphEdgeValues;
  /**
   * Returns all current node info within a graph.
   */
  nodeInformation: TopGraphNodeInfo;
  /**
   * Returns the GraphDescriptor of the current graph.
   * Or null if the TopGraphObserver doesn't know what it is yet.
   * The latter can happen when the graph hasn't run yet.
   */
  graph: GraphDescriptor | null;
  /**
   * Returns the status of the run, which can be one of:
   * - "running": The run is currently running.
   * - "paused": The run is paused.
   * - "stopped": The run is stopped.
   */
  status: TopGraphObserverRunStatus;
};

export type ComparableEdge = {
  equals(other: InspectableEdge): boolean;
};

/**
 * Reflects the current status of the edge:
 * - "initilal" -- the edge is in its initial state: no
 *   values have been stored on or consumed from this edge.
 * - "stored" -- a value was stored on the edge, but not yet consumed by the
 *   receiving node.
 * - "consumed" -- the value that was stored on the edge was consumed by the
 *   receiving edge. Constant wires never reach this state.
 */
export type TopGraphEdgeInfoStatus = "initial" | "stored" | "consumed";

export type TopGraphEdgeInfo = {
  status: TopGraphEdgeInfoStatus;
  value: NodeValue;
};

export type TopGraphEdgeValues = {
  get(edge: InspectableEdge): TopGraphEdgeInfo[] | undefined;
  current: ComparableEdge | null;
};

export type TopGraphNodeInfo = {
  getActivity(node: NodeIdentifier): ComponentActivityItem[] | undefined;
  canRunNode(node: NodeIdentifier): boolean;
};

export type ComponentWithActivity = {
  descriptor: NodeDescriptor;
  activity: ComponentActivityItem[];
};

/**
 * Each activity is a record of what happened within the node.
 * The most recent activity is the last item in the array.
 */
export type ComponentActivityItem = {
  type: "input" | "output" | "error" | "node" | "graph";
  description: string;
  path: number[];
};

export type NodePortConfiguration = {
  id: string;
  title: string | null;
  type: string | null;
  subGraphId: string | null;
  selectedPort: string | null;
  metadata: NodeMetadata | null;
  ports: InspectableNodePorts;
  /**
   * If the node configuration is set its values will be used in preference
   * to those found in the InspectableNodePorts (`ports`) list.
   */
  nodeConfiguration: NodeConfiguration | null;
  x: number;
  y: number;
  addHorizontalClickClearance: boolean;
  currentMetadata: NodeHandlerMetadata | null;
  graphNodeLocation: DOMRect | null;
};

export type EdgeValueConfiguration = {
  id: string;
  info: TopGraphEdgeInfo[] | null;
  schema: Schema | null;
  edge: EdgeData | null;
  x: number;
  y: number;
};

export type CommentConfiguration = {
  value: CommentNode | null;
  subGraphId: string | null;
  x: number;
  y: number;
};

export type BoardActivityLocation = {
  x: number;
  y: number;
};

export interface UserMessage {
  srcset: string;
  src: string;
  alt: string;
}

export type RunIdentifier = string;

export type CodeMirrorExtensions = {
  tsSync: typeof tsSync;
  tsFacet: typeof tsFacet;
  tsLinter: typeof tsLinter;
  tsAutocomplete: typeof tsAutocomplete;
  tsHover: typeof tsHover;
};

export type TypeScriptLanguageSupport = {
  env: VirtualTypeScriptEnvironment | null;
  extensions: CodeMirrorExtensions | null;
};

export interface Command {
  title: string;
  name: string;
  icon: string;
  callback?: (command: string, secondaryAction?: string | null) => void;
  disabled?: boolean;
  secondaryAction?: string;
}

export interface OverflowAction {
  title: string;
  name: string;
  icon: string;
  disabled?: boolean;
  value?: string;
  secondaryAction?: string;
}

export type ReferenceIdentifier =
  `${NodeIdentifier}|${PortIdentifier}|${number}`;

export interface GraphSelectionState {
  nodes: Set<NodeIdentifier>;
  assets: Set<AssetPath>;
  assetEdges: Set<string>;
  comments: Set<string>;
  edges: Set<string>;
  references: Set<ReferenceIdentifier>;
}

export interface GraphEntityVisualState {
  type: "node" | "comment";
  x: number;
  y: number;
  expansionState: "collapsed" | "expanded" | "advanced";
  outputHeight: number;
}

export type GraphVisualState = {
  nodes: Map<NodeIdentifier, GraphEntityVisualState>;
  graph: GraphMetadata;
};

export type WorkspaceVisualChangeId = ReturnType<typeof crypto.randomUUID>;
export type WorkspaceVisualState = Map<GraphIdentifier, GraphVisualState>;
export interface WorkspaceVisualStateWithChangeId {
  visualChangeId: WorkspaceVisualChangeId;
  visualState: WorkspaceVisualState;
}

export type WorkspaceSelectionChangeId = ReturnType<typeof crypto.randomUUID>;
export type WorkspaceSelectionState = {
  graphs: Map<GraphIdentifier, GraphSelectionState>;
  modules: Set<ModuleIdentifier>;
};
export interface WorkspaceSelectionStateWithChangeId {
  selectionChangeId: WorkspaceSelectionChangeId;
  selectionState: WorkspaceSelectionState;
  moveToSelection: "immediate" | "animated" | false;
}

export interface GraphHighlightState {
  nodes: Set<NodeIdentifier>;
  comments: Set<string>;
  edges: Set<string>;
}
export type HighlightChangeId = ReturnType<typeof crypto.randomUUID>;
export type HighlightState = {
  graphs: Map<GraphIdentifier, GraphHighlightState>;
};
export interface HighlightStateWithChangeId {
  highlightChangeId: HighlightChangeId;
  highlightState: HighlightState;
  highlightType: "user" | "model";
}

export interface DragConnectorReceiver extends HTMLElement {
  isOnDragConnectorTarget(): boolean;
  highlight(): void;
  removeHighlight(): void;
}

export type LanguagePackEntry = Record<
  string,
  { str: string; desc?: string } | string
>;

/**
 * Explicitly list the language packs to ensure new packs contain the correct
 * top-level entries.
 */
export interface LanguagePack {
  ActivityLog: LanguagePackEntry;
  AppPreview: LanguagePackEntry;
  AssetOrganizer: LanguagePackEntry;
  AudioHandler: LanguagePackEntry;
  CommandPalette: LanguagePackEntry;
  ComponentSelector: LanguagePackEntry;
  Editor: LanguagePackEntry;
  FocusEditor: LanguagePackEntry;
  Global: LanguagePackEntry;
  KitSelector: LanguagePackEntry;
  ProjectListing: LanguagePackEntry;
  UIController: LanguagePackEntry;
  WorkspaceOutline: LanguagePackEntry;
}

export interface AppThemeColors {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  primaryTextColor: string;
}

export type AppTheme = AppThemeColors & {
  splashScreen?: InlineDataCapabilityPart | StoredDataCapabilityPart | null;
};

export interface AppTemplateAdditionalOption {
  values: Array<{ value: string; title: string }>;
  title: string;
}

export type AppTemplateAdditionalOptionsAvailable = Record<
  string,
  AppTemplateAdditionalOption
>;

export type AppTemplateAdditionalOptionsChosen = Record<string, string>;

export interface AppTemplateOptions {
  title?: string | null;
  description?: string | null;
  mode: "light" | "dark";
  theme?: AppThemeColors;
  splashImage: string | boolean;
  additionalOptions?: AppTemplateAdditionalOptionsChosen;
}

export interface AppTemplate extends LitElement {
  state: SigninState | null;
  options: AppTemplateOptions;
  run: InspectableRun | null;
  graph: GraphDescriptor | null;
  topGraphResult: TopGraphRunResult | null;
  eventPosition: number;
  additionalOptions: AppTemplateAdditionalOptionsAvailable;
  showGDrive: boolean;
  isInSelectionState: boolean;
  showingOlderResult: boolean;
  appURL: string | null;
  readOnly: boolean;
}

export interface Utterance {
  isFinal: boolean;
  confidence: number;
  transcript: string;
}

export type EdgeAttachmentPoint = "Top" | "Right" | "Bottom" | "Left" | "Auto";

export interface NewAsset {
  name: string;
  type: AssetType;
  path: AssetPath;
  data: LLMContent;
  subType?: string;
  visual?: Record<string, number>;
}

export interface AssetEdge {
  direction: InspectableAssetEdgeDirection;
  nodeId: NodeIdentifier;
  assetPath: AssetPath;
}

export type EnumValue = {
  title: string;
  id: string;
  icon?: string;
  description?: string;
  tag?: string; // Typically used for keyboard shortcuts.
  hidden?: boolean;
};
