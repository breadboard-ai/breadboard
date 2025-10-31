/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseEventDetail } from "../base";

type Namespace = "theme";

export interface Change extends BaseEventDetail<`${Namespace}.change`> {
  readonly id: string;
}
