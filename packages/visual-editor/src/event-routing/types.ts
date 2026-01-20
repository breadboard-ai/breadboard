/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardServer } from "@breadboard-ai/types";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { Runtime } from "../runtime/runtime.js";
import { Tab } from "../runtime/types.js";
import { type OAuthScope } from "../ui/connection/oauth-scopes.js";
import { SettingsStore } from "../ui/data/settings-store.js";
import { EmbedHandler } from "../ui/embed/embed.js";
import type * as BreadboardUI from "../ui/index.js";
import { ActionTracker, UserSignInResponse } from "../ui/types/types.js";
import { AppController } from "../controller/controller.js";

type StateCustomEvent<K extends keyof BreadboardUI.Events.StateEventDetailMap> =
  BreadboardUI.Events.StateEvent<K>;

export interface EventRouteDeps<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  originalEvent: StateCustomEvent<K>;
  runtime: Runtime;
  settings: SettingsStore | null;
  tab: Tab | null;
  appController: AppController;
  googleDriveClient: GoogleDriveClient | null;
  askUserToSignInIfNeeded(scopes?: OAuthScope[]): Promise<UserSignInResponse>;
  boardServer: BoardServer;
  embedHandler?: EmbedHandler;
  actionTracker?: ActionTracker;
}

export interface EventRoute<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  event: K;
  do(deps: EventRouteDeps<K>): Promise<boolean>;
}
