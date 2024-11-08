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
  NodeConfiguration,
  RunStore,
} from "@google-labs/breadboard";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { TokenVendor } from "@breadboard-ai/connection-client";
import { ModuleIdentifier } from "@breadboard-ai/types";
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
  graph: GraphDescriptor;
  subGraphId: string | null;
  moduleId: ModuleIdentifier | null;
  version: number;
  readOnly: boolean;
  type: TabType;
}

export interface RuntimeConfig {
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
