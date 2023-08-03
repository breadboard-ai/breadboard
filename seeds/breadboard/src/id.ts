/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class IdVendor {
  #map = new Map<object, number>();

  vendId(o: object, prefix: string) {
    let count = this.#map.get(o) || 0;
    count++;
    this.#map.set(o, count);
    return `${prefix}-${count}`;
  }
}
