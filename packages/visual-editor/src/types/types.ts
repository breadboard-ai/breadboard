/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmbedHandler } from "@breadboard-ai/embed";
import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import { type ClientDeploymentConfiguration } from "@breadboard-ai/types/deployment-configuration.js";
import { type BuildInfo } from "@breadboard-ai/shared-ui/contexts/build-info.js";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import {
  BoardServer,
  HarnessProxyConfig,
  Kit,
  MutableGraphStore,
  NodeHandlerContext,
  Outcome,
  FileSystemEntry,
} from "@breadboard-ai/types";

export type BootstrapArguments = {
  deploymentConfiguration: ClientDeploymentConfiguration;
  connectionServerUrl?: URL;
  requiresSignin?: boolean;
  defaultBoardService?: string;
  kits?: Kit[];
  /**
   * Allows preloading graphs into the graphstore. Useful when you want to
   * supply graphs that aren't part of any board server.
   * @param graphStore
   * @returns
   */
  graphStorePreloader?: (graphStore: MutableGraphStore) => void;
  /**
   * Allows filtering what modules can be invoked by the runtime.
   * @param context
   * @returns
   */
  moduleInvocationFilter?: (context: NodeHandlerContext) => Outcome<void>;
  /**
   * Provides a way to specify additional entries as part of the `/env/` file
   * system.
   */
  env?: FileSystemEntry[];
  /**
   * Provides a way to handle embedded versions of Breadboard.
   */
  embedHandler?: EmbedHandler;
};

export type MainArguments = {
  boards?: BreadboardUI.Types.Board[];
  providers?: BoardServer[]; // Deprecated.
  settings?: SettingsStore;
  proxy?: HarnessProxyConfig[];
  environmentName?: string;
  buildInfo: BuildInfo;
  languagePack?: string;
  /**
   * The URL of the board server with which this editor instance
   * is associated.
   */
  boardServerUrl?: URL;
  /**
   * The URL of the connection server with which this editor instance
   * is associated.
   */
  connectionServerUrl?: URL;
  /**
   * Whether or not this instance of requires sign in.
   */
  requiresSignin?: boolean;
  /** If true enforces ToS acceptance by the user on the first visit. */
  enableTos?: boolean;
  /** Terms of Service content. */
  tosHtml?: string;
  kits?: Kit[];
  graphStorePreloader?: (graphStore: MutableGraphStore) => void;
  moduleInvocationFilter?: (context: NodeHandlerContext) => Outcome<void>;
  /**
   * Provides a way to specify additional entries as part of the `/env/` file
   * system.
   */
  env?: FileSystemEntry[];
  embedHandler?: EmbedHandler;
  clientDeploymentConfiguration: ClientDeploymentConfiguration;
};

export enum TosStatus {
  ACCEPTED = "accepted",
}
