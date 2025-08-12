/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { Runtime } from "../runtime/runtime";
import { Tab, WorkspaceSelectionStateWithChangeId } from "../runtime/types";
import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import { MutableGraphStore } from "@breadboard-ai/types";

export interface KeyboardCommandDeps {
  runtime: Runtime;
  selectionState: WorkspaceSelectionStateWithChangeId | null;
  graphStore: MutableGraphStore;
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
