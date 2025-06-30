/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { RuntimeInstance } from "../runtime/runtime";
import { Tab, WorkspaceSelectionStateWithChangeId } from "../runtime/types";
import type * as BreadboardUI from "@breadboard-ai/shared-ui";

export interface KeyboardCommandDeps {
  runtime: RuntimeInstance;
  selectionState: WorkspaceSelectionStateWithChangeId | null;
  tab: Tab | null;
  originalEvent: KeyboardEvent;
  pointerLocation: { x: number; y: number };
  settings: SettingsStore | null;
}

export interface KeyboardCommand {
  keys: string[];
  do(deps: Partial<KeyboardCommandDeps>): Promise<void>;
  willHandle(tab: Tab | null, evt: Event): boolean;
  alwaysNotify?: boolean;
  messagePending?: string;
  messageError?: string;
  messageComplete?: string;
  messageTimeout?: number;
  messageType?: BreadboardUI.Events.ToastType;
}
