/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Action } from "../types/types.js";
import { BaseEventDetail } from "./base.js";

type Namespace = "gulf";

export interface GulfAction extends BaseEventDetail<`${Namespace}.action`> {
  readonly action: Action;
}
