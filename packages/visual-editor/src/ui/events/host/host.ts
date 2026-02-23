/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RuntimeFlags } from "@breadboard-ai/types";
import {
  SelectionChangeId,
  MultiGraphSelectionState,
} from "../../types/types.js";
import { UserSignInResponse, VisualEditorMode } from "../../../sca/types.js";
import { BaseEventDetail } from "../base.js";

type MoveToSelection = "immediate" | "animated" | false;
type Namespace = "host";

export interface Load extends BaseEventDetail<`${Namespace}.load`> {
  readonly url: string;
}

export interface Run extends BaseEventDetail<`${Namespace}.run`> {
  /* Duped to avoid @typescript-eslint/no-empty-object-type */
  readonly eventType: `${Namespace}.run`;
}

export type Stop = BaseEventDetail<`${Namespace}.stop`>;

export interface ModeToggle extends BaseEventDetail<`${Namespace}.modetoggle`> {
  readonly mode: VisualEditorMode;
}

export interface SelectionStateChange extends BaseEventDetail<`${Namespace}.selectionstatechange`> {
  readonly selectionChangeId: SelectionChangeId;
  readonly selections: MultiGraphSelectionState | null;
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

export interface FlagChange extends BaseEventDetail<`${Namespace}.flagchange`> {
  readonly flag: keyof RuntimeFlags;
  readonly value: boolean | undefined;
}

export interface UserSignIn extends BaseEventDetail<`${Namespace}.usersignin`> {
  readonly result: UserSignInResponse;
}
