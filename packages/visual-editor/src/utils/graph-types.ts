/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EmbedHandler } from "@breadboard-ai/types/embedder.js";
import { type OAuthScope } from "../ui/connection/oauth-scopes.js";
import { type UserSignInResponse } from "../ui/types/types.js";
import {
  AssetPath,
  FileSystemEntry,
  GraphIdentifier,
  GraphMetadata,
  NodeIdentifier,
  PortIdentifier,
} from "@breadboard-ai/types";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import type { GlobalConfig } from "../ui/contexts/global-config.js";
import { GuestConfiguration } from "@breadboard-ai/types/opal-shell-protocol.js";
import { SCA } from "../sca/sca.js";

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

export type EditChangeId = ReturnType<typeof crypto.randomUUID>;
export type MoveToSelection = "immediate" | "animated" | false;

export type VisualEditorMode = "app" | "canvas";

export type Control<T> = T | { $control: string };
