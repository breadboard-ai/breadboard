/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphTheme } from "@breadboard-ai/types";
import { AppTheme } from "../../types/types";
import { BaseEventDetail } from "../base";

type Namespace = "theme";

export interface Change extends BaseEventDetail<`${Namespace}.change`> {
  readonly id: string;
}

export interface Create extends BaseEventDetail<`${Namespace}.create`> {
  // TODO: Change this over to GraphTheme.
  readonly theme: AppTheme;
}

export interface Delete extends BaseEventDetail<`${Namespace}.delete`> {
  readonly id: string;
}

export interface Update extends BaseEventDetail<`${Namespace}.update`> {
  readonly id: string;
  readonly theme: GraphTheme;
}
