/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseEventDetail } from "../base.js";

type Namespace = "flowgen";

export interface Generate extends BaseEventDetail<`${Namespace}.generate`> {
  readonly intent: string;
}
