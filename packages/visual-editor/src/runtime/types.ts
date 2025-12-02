/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoardServer, OutputValues } from "@breadboard-ai/types";
import {
  EditHistoryCreator,
  EditHistoryEntry,
  GraphDescriptor,
  MainGraphIdentifier,
  PortIdentifier,
  FileSystemEntry,
} from "@google-labs/breadboard";

import {
  AssetPath,
  GraphIdentifier,
  GraphMetadata,
  ModuleIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import type { GlobalConfig } from "@breadboard-ai/shared-ui/contexts/global-config.js";
import {
  OpalShellHostProtocol,
  SignInState,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

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
  globalConfig: GlobalConfig;
  settings: SettingsStore;
  shellHost: OpalShellHostProtocol;
  initialSignInState: SignInState;
  env?: FileSystemEntry[];
  appName: string;
  appSubName: string;
}

export interface RuntimeConfigBoardServers {
  a2Server: BoardServer;
  googleDriveBoardServer: GoogleDriveBoardServer;
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

export type TabSelectionState = Map<TabId, WorkspaceSelectionState>;
export type EditChangeId = ReturnType<typeof crypto.randomUUID>;
export type MoveToSelection = "immediate" | "animated" | false;

export type VisualEditorMode = "app" | "canvas";
