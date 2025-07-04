/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  VisualEditorMode,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
} from "../../types/types";

type MoveToSelection = "immediate" | "animated" | false;
type Namespace = "host";

export interface Load {
  readonly eventType: `${Namespace}.load`;
  readonly url: string;
}

export interface Run {
  readonly eventType: `${Namespace}.run`;
}

export interface Stop {
  readonly eventType: `${Namespace}.stop`;
  readonly clearLastRun: boolean;
}

export interface ModeToggle {
  readonly eventType: `${Namespace}.modetoggle`;
  readonly mode: VisualEditorMode;
}

export interface SelectionStateChange {
  readonly eventType: `${Namespace}.selectionstatechange`;
  readonly selectionChangeId: WorkspaceSelectionChangeId;
  readonly selections: WorkspaceSelectionState | null;
  readonly replaceExistingSelections: boolean;
  readonly moveToSelection: MoveToSelection;
}
