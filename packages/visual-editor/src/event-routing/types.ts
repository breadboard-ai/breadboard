/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore } from "../ui/data/settings-store.js";
import { Runtime } from "../runtime/runtime";
import { Tab } from "../runtime/types";
import type * as BreadboardUI from "../ui/index.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { type OAuthScope } from "../ui/connection/oauth-scopes.js";
import { BoardServer } from "@breadboard-ai/types";
import { EmbedHandler } from "../ui/embed/embed.js";
import { UserSignInResponse } from "../ui/types/types.js";

type StateCustomEvent<K extends keyof BreadboardUI.Events.StateEventDetailMap> =
  BreadboardUI.Events.StateEvent<K>;

export interface EventRouteDeps<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  originalEvent: StateCustomEvent<K>;
  runtime: Runtime;
  settings: SettingsStore | null;
  tab: Tab | null;
  uiState: BreadboardUI.State.UI;
  googleDriveClient: GoogleDriveClient | null;
  askUserToSignInIfNeeded(scopes?: OAuthScope[]): Promise<UserSignInResponse>;
  boardServer: BoardServer;
  embedHandler?: EmbedHandler;
}

export interface EventRoute<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  event: K;
  do(deps: EventRouteDeps<K>): Promise<boolean>;
}
