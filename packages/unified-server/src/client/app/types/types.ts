/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppTheme,
  type AppTemplate,
} from "@breadboard-ai/shared-ui/types/types.js";
import type * as BreadboardUIContext from "@breadboard-ai/shared-ui/contexts";
import type * as ConnectionClient from "@breadboard-ai/connection-client";
import { HarnessRunner } from "@google-labs/breadboard/harness";
import { type SettingsHelperImpl } from "@breadboard-ai/shared-ui/data/settings-helper.js";
import { TopGraphObserver } from "@breadboard-ai/shared-ui/utils/top-graph-observer";
import {
  GraphDescriptor,
  InspectableRunObserver,
  Kit,
  RunStore,
} from "@google-labs/breadboard";
import { type SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";

export type Runner = {
  harnessRunner: HarnessRunner;
  topGraphObserver: TopGraphObserver;
  runObserver: InspectableRunObserver;
  abortController: AbortController;
  kits: Kit[];
  runStore: RunStore;
};

export interface AppViewConfig {
  flow: GraphDescriptor;
  template: AppTemplate;
  environment: BreadboardUIContext.Environment;
  tokenVendor: ConnectionClient.TokenVendor;
  signinAdapter: SigninAdapter;
  settingsHelper: SettingsHelperImpl;
  runner: Runner | null;
  theme: AppTheme | null;
  isDefautTheme: boolean;
  title: string | null;
  description: string | null;
  templateAdditionalOptions: Record<string, string> | null;
  googleDriveClient: GoogleDriveClient;
}

export type BootstrapArguments = {
  proxyServerUrl?: URL;
  boardServerUrl?: URL;
  connectionServerUrl?: URL;
  requiresSignin?: boolean;
};
