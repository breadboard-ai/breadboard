/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { Runtime } from "../runtime/runtime";
import { Tab } from "../runtime/types";
import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import { SecretsHelper } from "../utils/secrets-helper";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { type OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";

type StateCustomEvent<K extends keyof BreadboardUI.Events.StateEventDetailMap> =
  BreadboardUI.Events.StateEvent<K>;

export interface EventRouteDeps<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  originalEvent: StateCustomEvent<K>;
  runtime: Runtime;
  secretsHelper: SecretsHelper;
  settings: SettingsStore | null;
  tab: Tab | null;
  uiState: BreadboardUI.State.UI;
  googleDriveClient: GoogleDriveClient | null;
  askUserToSignInIfNeeded(scopes?: OAuthScope[]): Promise<boolean>;
}

export interface EventRoute<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  event: K;
  do(deps: EventRouteDeps<K>): Promise<boolean>;
}
