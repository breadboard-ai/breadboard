/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * FIXME: Legacy event routing types — delete when all routes are migrated
 * to SCA actions.
 */

import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";

import type * as BreadboardUI from "../ui/index.js";
import { ActionTracker } from "../ui/types/types.js";
import { type SCA } from "../sca/sca.js";

type StateCustomEvent<K extends keyof BreadboardUI.Events.StateEventDetailMap> =
  BreadboardUI.Events.StateEvent<K>;

export interface EventRouteDeps<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  originalEvent: StateCustomEvent<K>;

  sca: SCA;
  googleDriveClient: GoogleDriveClient | null;
  actionTracker?: ActionTracker;
}

export interface EventRoute<
  K extends keyof BreadboardUI.Events.StateEventDetailMap,
> {
  event: K;
  do(deps: EventRouteDeps<K>): Promise<boolean>;
}
