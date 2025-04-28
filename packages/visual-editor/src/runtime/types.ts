/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  EditHistoryCreator,
  EditHistoryEntry,
  FileSystem,
  GraphDescriptor,
  GraphLoader,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  NodeConfiguration,
  PortIdentifier,
  RunStore,
} from "@google-labs/breadboard";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
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
import { HarnessProxyConfig } from "@google-labs/breadboard/harness";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";

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
  subGraphId: string | null;
  moduleId: ModuleIdentifier | null;
  version: number;
  readOnly: boolean;
  type: TabType;
  creator?: EditHistoryCreator;
  history?: EditHistoryEntry[];
  onHistoryChanged?: (history: readonly EditHistoryEntry[]) => void;
}

export interface RuntimeConfig {
  graphStore: MutableGraphStore;
  runStore: RunStore;
  sandbox: Sandbox;
  experiments: Record<string, boolean>;
  environment?: BreadboardUI.Contexts.Environment;
  tokenVendor: TokenVendor;
  settings: SettingsStore;
  fileSystem: FileSystem;
  proxy?: HarnessProxyConfig[];
  // The board servers that are built in: initialized separately and come
  // as part of the environment.
  builtInBoardServers: BoardServer[];
  kits: Kit[];
}

export interface RuntimeConfigBoardServers {
  servers: BoardServer[];
  loader: GraphLoader;
  graphStore: MutableGraphStore;
  // The board servers that are built in: initialized separately and come
  // as part of the environment.

  builtInBoardServers: BoardServer[];
}

export type Result<T> =
  | {
      success: false;
      error: string;
    }
  | {
      success: true;
      result: T;
    };

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
