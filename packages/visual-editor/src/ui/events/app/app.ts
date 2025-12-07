/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseEventDetail } from "../base.js";

type Namespace = "app";

export interface Fullscreen extends BaseEventDetail<`${Namespace}.fullscreen`> {
  readonly action: "activate" | "deactivate";
}
