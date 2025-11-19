/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EmbedHandler } from "@breadboard-ai/shared-ui/embed/embed.js";
import type { GlobalConfig } from "@breadboard-ai/shared-ui/contexts/global-config.js";
import type { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import type {
  FileSystemEntry,
  Kit,
  MutableGraphStore,
  NodeHandlerContext,
  Outcome,
} from "@breadboard-ai/types";
import type { ClientDeploymentConfiguration } from "@breadboard-ai/types/deployment-configuration.js";
import {
  OpalShellHostProtocol,
  SignInState,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { MakeUrlInit } from "@breadboard-ai/shared-ui/utils/urls.js";

export type BootstrapArguments = {
  deploymentConfiguration: ClientDeploymentConfiguration;
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
};

export type MainArguments = {
  settings: SettingsStore;
  languagePack?: string;
  /**
   * The URL of the board server with which this editor instance
   * is associated.
   */
  boardServerUrl?: URL;
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
  globalConfig: GlobalConfig;
  shellHost: OpalShellHostProtocol;
  initialSignInState: SignInState;
  parsedUrl?: MakeUrlInit;
};

export enum TosStatus {
  ACCEPTED = "accepted",
}
