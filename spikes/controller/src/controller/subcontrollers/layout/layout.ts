/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootStore } from "../root-store.js";

export class LayoutController extends RootStore {
  @field({ persist: "session" })
  private accessor _split = 0.5;

  @field({ persist: "local" })
  private accessor _min = 0.1;

  @field({ persist: "local" })
  private accessor _max = 0.9;

  get split() {
    return this._split;
  }

  get min() {
    return this._min;
  }

  get max() {
    return this._max;
  }

  setMinMax(min = 0.1, max = 0.9) {
    if (min < 0 || min > 1) throw new Error("Min out of bounds");
    if (max < 0 || max > 1) throw new Error("Max out of bounds");
    if (min > max) throw new Error("Min greater than max");

    this._min = min;
    this._max = max;
  }

  setSplit(split: number) {
    if (split > this._max) split = this._max;
    if (split < this._min) split = this._min;

    this._split = split;
  }
}
