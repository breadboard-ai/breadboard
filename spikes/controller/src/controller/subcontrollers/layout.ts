/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { api } from "../decorators/api";

export class LayoutStore {
  @api({ persist: "session" })
  private accessor _split = 0.5;

  get split() {
    return this._split;
  }

  setSplit(split: number) {
    split = Math.min(0.9, Math.max(0.1, split));

    this._split = split;
  }
}
