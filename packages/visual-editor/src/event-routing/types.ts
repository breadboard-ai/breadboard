/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { RuntimeInstance } from "../runtime/runtime";
import { Tab } from "../runtime/types";
import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import { HarnessProxyConfig } from "@breadboard-ai/types";

type StateCustomEvent<K extends keyof BreadboardUI.Events.StateEventDetailMap> =
  BreadboardUI.Events.StateEvent<K>;

export interface EventRouteDeps<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  originalEvent: StateCustomEvent<K>;
  proxy: HarnessProxyConfig[];
  runtime: RuntimeInstance;
  settings: SettingsStore | null;
  tab: Tab | null;
  uiState: BreadboardUI.State.UI;
}

export interface EventRoute<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  event: K;
  do(deps: EventRouteDeps<K>): Promise<boolean>;
}
