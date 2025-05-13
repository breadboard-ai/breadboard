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
import { type SettingsHelperImpl } from "../utils/settings.js";
import { TopGraphObserver } from "@breadboard-ai/shared-ui/utils/top-graph-observer";
import {
  GraphDescriptor,
  InspectableRunObserver,
  Kit,
  RunStore,
} from "@google-labs/breadboard";
import { type SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";

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
}

export type BootstrapArguments = {
  proxyServerUrl?: URL;
  boardServerUrl?: URL;
  connectionServerUrl?: URL;
  requiresSignin?: boolean;
};
