/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type AppTemplate } from "@breadboard-ai/shared-ui/types/types.js";
import type * as BreadboardUIContext from "@breadboard-ai/shared-ui/contexts";
import type * as ConnectionClient from "@breadboard-ai/connection-client";
import { type RunConfig } from "@google-labs/breadboard/harness";
import { type SettingsHelper } from "../utils/settings.js";

export interface AppViewConfig {
  template: AppTemplate;
  environment: BreadboardUIContext.Environment;
  tokenVendor: ConnectionClient.TokenVendor;
  settingsHelper: SettingsHelper;
  runConfig: RunConfig | null;
}

export type BootstrapArguments = {
  proxyServerUrl?: URL;
  boardServerUrl?: URL;
  connectionServerUrl?: URL;
  requiresSignin?: boolean;
};
