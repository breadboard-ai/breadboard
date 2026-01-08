/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EmbedHandler } from "../ui/embed/embed.js";
import type { GlobalConfig } from "../ui/contexts/global-config.js";
import type { SettingsStore } from "../ui/data/settings-store.js";
import type { FileSystemEntry } from "@breadboard-ai/types";
import type { ClientDeploymentConfiguration } from "@breadboard-ai/types/deployment-configuration.js";
import type {
  GuestConfiguration,
  OpalShellHostProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { MakeUrlInit } from "../ui/types/types.js";

export type BootstrapArguments = {
  deploymentConfiguration: ClientDeploymentConfiguration;
  /**
   * Provides a way to specify additional entries as part of the `/env/` file
   * system.
   */
  env?: FileSystemEntry[];
};

export type MainArguments = {
  settings: SettingsStore;
  languagePack?: string;
  /** If true enforces ToS acceptance by the user on the first visit. */
  enableTos?: boolean;
  /** Terms of Service content. */
  tosHtml?: string;

  /**
   * Provides a way to specify additional entries as part of the `/env/` file
   * system.
   */
  env?: FileSystemEntry[];
  embedHandler?: EmbedHandler;
  globalConfig: GlobalConfig;
  guestConfiguration: GuestConfiguration;
  shellHost: OpalShellHostProtocol;
  hostOrigin: URL;
  parsedUrl?: MakeUrlInit;
};

export enum TosStatus {
  ACCEPTED = "accepted",
}
