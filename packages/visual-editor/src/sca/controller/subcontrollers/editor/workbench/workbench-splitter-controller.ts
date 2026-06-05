/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";

export class WorkbenchSplitterController extends RootController {
  readonly min = 0.2;
  readonly max = 0.8;

  @field({ persist: "session" })
  private accessor _split = 0.3;

  @field()
  private accessor _minRightPixelWidth = 350;

  @field()
  private accessor _minLeftPixelWidth = 350;

  get split() {
    return this._split;
  }

  get minRightPixelWidth() {
    return this._minRightPixelWidth;
  }

  get minLeftPixelWidth() {
    return this._minLeftPixelWidth;
  }

  setSplit(split: number) {
    if (split > this.max) split = this.max;
    if (split < this.min) split = this.min;

    this._split = split;
  }

  getClampedValues(split: number, bounds: DOMRectReadOnly) {
    let right = 1 - split;
    let left = split;
    if (bounds.width > 0) {
      if (right * bounds.width < this.minRightPixelWidth) {
        right = this.minRightPixelWidth / bounds.width;
        left = 1 - right;
      } else if (left * bounds.width < this.minLeftPixelWidth) {
        left = this.minLeftPixelWidth / bounds.width;
        right = 1 - left;
      }
    }

    return [left, right];
  }
}
