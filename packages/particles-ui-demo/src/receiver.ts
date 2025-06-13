/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { List } from "./state/list";
import { GeneratorProxy } from "./types/types";

export { Receiver };

class Receiver {
  constructor(
    public readonly channel: GeneratorProxy,
    public readonly list: List
  ) {}
}
