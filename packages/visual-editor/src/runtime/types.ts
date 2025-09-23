/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BoardServer,
  GraphLoader,
  HarnessProxyConfig,
  OutputValues,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import {
  EditHistoryCreator,
  EditHistoryEntry,
  FileSystem,
  GraphDescriptor,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  NodeConfiguration,
  PortIdentifier,
} from "@google-labs/breadboard";

import { TokenVendor } from "@breadboard-ai/connection-client";
import {
  AssetPath,
  GraphIdentifier,
  GraphMetadata,
  ModuleIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { Sandbox } from "@breadboard-ai/jsandbox";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { RecentBoardStore } from "../data/recent-boards";
import type { GlobalConfig } from "@breadboard-ai/shared-ui/contexts/global-config.js";
import { McpClientManager } from "@breadboard-ai/mcp";
import type { Result } from "@breadboard-ai/types/result.js";

export enum TabType {
  URL,
  DESCRIPTOR,
  RUN,
}

export type TabId = `${string}-${string}-${string}-${string}-${string}`;
export type TabURL = string;
export type TabName = string;
export interface Tab {
  id: TabId;
  boardServerKits: Kit[];
  name: TabName;
  mainGraphId: MainGraphIdentifier;
  graph: GraphDescriptor;
  graphIsMine: boolean;
  subGraphId: string | null;
  moduleId: ModuleIdentifier | null;
  version: number;
  lastLoadedVersion: number;
  readOnly: boolean;
  type: TabType;
  /**
   * The board server for this tab. Since we know what
   * the graph is, we also know what the board server
   * will be (if any).
   */
  boardServer: BoardServer | null;
  creator?: EditHistoryCreator;
  history?: EditHistoryEntry[];
  onHistoryChanged?: (history: readonly EditHistoryEntry[]) => void;
  finalOutputValues?: OutputValues;
}

export interface RuntimeConfig {
  graphStore: MutableGraphStore;
  sandbox: Sandbox;
  experiments: Record<string, boolean>;
  globalConfig?: GlobalConfig;
  tokenVendor: TokenVendor;
  settings: SettingsStore;
  fileSystem: FileSystem;
  proxy?: HarnessProxyConfig[];
  // The board servers that are built in: initialized separately and come
  // as part of the environment.
  builtInBoardServers: BoardServer[];
  kits: Kit[];
  googleDriveClient?: GoogleDriveClient;
  appName: string;
  appSubName: string;
  recentBoardStore: RecentBoardStore;
  flags: RuntimeFlagManager;
  mcpClientManager: McpClientManager;
}

export interface RuntimeConfigBoardServers {
  servers: BoardServer[];
  loader: GraphLoader;
  graphStore: MutableGraphStore;
  // The board servers that are built in: initialized separately and come
  // as part of the environment.

  builtInBoardServers: BoardServer[];
}

export type EnhanceSideboard = {
  enhance(config: NodeConfiguration): Promise<Result<NodeConfiguration>>;
};

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

export type TabSelectionState = Map<TabId, WorkspaceSelectionState>;
export type EditChangeId = ReturnType<typeof crypto.randomUUID>;
export type MoveToSelection = "immediate" | "animated" | false;

export type SideboardRuntimeProvider = {
  createSideboardRuntime(): SideBoardRuntime;
};

export type VisualEditorMode = "app" | "canvas";
