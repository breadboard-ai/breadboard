/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoardServer, OutputValues } from "@breadboard-ai/types";
import type { EmbedHandler } from "@breadboard-ai/types/embedder.js";
import { type OAuthScope } from "../ui/connection/oauth-scopes.js";
import { type UserSignInResponse } from "../ui/types/types.js";
import {
  AssetPath,
  EditHistoryCreator,
  EditHistoryEntry,
  FileSystemEntry,
  GraphDescriptor,
  GraphIdentifier,
  GraphMetadata,
  MainGraphIdentifier,
  NodeIdentifier,
  PortIdentifier,
} from "@breadboard-ai/types";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import type { GlobalConfig } from "../ui/contexts/global-config.js";
import { GuestConfiguration } from "@breadboard-ai/types/opal-shell-protocol.js";
import { SCA } from "../sca/sca.js";

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
  sca?: Readonly<SCA>;
  globalConfig: GlobalConfig;
  guestConfig: GuestConfiguration;

  shellHost: OpalShellHostProtocol;
  embedHandler?: EmbedHandler;
  env?: FileSystemEntry[];
  appName: string;
  appSubName: string;
  askUserToSignInIfNeeded?: (
    scopes?: OAuthScope[]
  ) => Promise<UserSignInResponse>;
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

export type Control<T> = T | { $control: string };
