/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserAction } from "../types/types.js";
import { BaseEventDetail } from "./base.js";

type Namespace = "a2ui";

export interface A2UIAction extends BaseEventDetail<`${Namespace}.action`> {
  readonly userAction: UserAction;
  readonly dataContextPath: string;
  readonly sourceComponentId: string;
}
