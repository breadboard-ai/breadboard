/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore } from "../ui/data/settings-store.js";
import { Runtime } from "../runtime/runtime.js";
import { Tab, WorkspaceSelectionStateWithChangeId } from "../runtime/types.js";
import type * as BreadboardUI from "../ui/index.js";
import type { SCA } from "../sca/sca.js";

export interface KeyboardCommandDeps {
  runtime: Runtime;
  sca: SCA;
  selectionState: WorkspaceSelectionStateWithChangeId | null;
  tab: Tab | null;
  originalEvent: KeyboardEvent;
  pointerLocation: { x: number; y: number };
  settings: SettingsStore | null;
  strings: ReturnType<typeof BreadboardUI.Strings.forSection>;
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
