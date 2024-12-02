/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  DataStore,
  GraphDescriptor,
  GraphLoader,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  NodeConfiguration,
  RunStore,
} from "@google-labs/breadboard";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { TokenVendor } from "@breadboard-ai/connection-client";
import {
  GraphIdentifier,
  ModuleIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { Sandbox } from "@breadboard-ai/jsandbox";

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
  kits: Kit[];
  name: TabName;
  mainGraphId: MainGraphIdentifier;
  graph: GraphDescriptor;
  subGraphId: string | null;
  moduleId: ModuleIdentifier | null;
  version: number;
  readOnly: boolean;
  type: TabType;
}

export interface RuntimeConfig {
  graphStore: MutableGraphStore;
  dataStore: DataStore;
  runStore: RunStore;
  sandbox: Sandbox;
  experiments: Record<string, boolean>;
  environment?: BreadboardUI.Contexts.Environment;
  tokenVendor?: TokenVendor;
}

export interface RuntimeConfigBoardServers {
  servers: BoardServer[];
  loader: GraphLoader;
  graphStore: MutableGraphStore;
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

export interface GraphSelectionState {
  nodes: Set<NodeIdentifier>;
  comments: Set<string>;
  edges: Set<string>;
}

export interface GraphEntityVisualState {
  type: "node" | "comment";
  x: number;
  y: number;
  expansionState: "collapsed" | "expanded" | "advanced";
}

export type GraphVisualState = Map<NodeIdentifier, GraphEntityVisualState>;

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
}

export type TabSelectionState = Map<TabId, WorkspaceSelectionState>;
export type EditChangeId = ReturnType<typeof crypto.randomUUID>;
