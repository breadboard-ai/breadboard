/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class Rect implements DOMRectReadOnly {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}

  get top() {
    return this.x;
  }
  get bottom() {
    return this.height;
  }
  get left() {
    return this.x;
  }
  get right() {
    return this.width;
  }
  toJSON() {
    // Unimplemented.
  }
}
