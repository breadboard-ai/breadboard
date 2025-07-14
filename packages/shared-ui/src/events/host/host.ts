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
import { BaseEventDetail } from "../base";

type MoveToSelection = "immediate" | "animated" | false;
type Namespace = "host";

export interface Load extends BaseEventDetail<`${Namespace}.load`> {
  readonly url: string;
}

export interface Run extends BaseEventDetail<`${Namespace}.run`> {
  /* Duped to avoid @typescript-eslint/no-empty-object-type */
  readonly eventType: `${Namespace}.run`;
}

export interface Stop extends BaseEventDetail<`${Namespace}.stop`> {
  readonly clearLastRun: boolean;
}

export interface ModeToggle extends BaseEventDetail<`${Namespace}.modetoggle`> {
  readonly mode: VisualEditorMode;
}

export interface SelectionStateChange
  extends BaseEventDetail<`${Namespace}.selectionstatechange`> {
  readonly selectionChangeId: WorkspaceSelectionChangeId;
  readonly selections: WorkspaceSelectionState | null;
  readonly replaceExistingSelections: boolean;
  readonly moveToSelection: MoveToSelection;
}

export interface Lock extends BaseEventDetail<`${Namespace}.lock`> {
  /* Duped to avoid @typescript-eslint/no-empty-object-type */
  readonly eventType: `${Namespace}.lock`;
}

export interface Unlock extends BaseEventDetail<`${Namespace}.unlock`> {
  /* Duped to avoid @typescript-eslint/no-empty-object-type */
  readonly eventType: `${Namespace}.unlock`;
}
