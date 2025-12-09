/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";

export { FilteredMap };

export type TitledItem = {
  title?: string;
};

class FilteredMap<Item extends TitledItem> {
  @signal
  accessor filter: string = "";

  @signal
  get results(): ReadonlyMap<string, Item> {
    if (!this.filter) return this.items;
    const filter = new RegExp(this.filter, "gim");
    const filtered = new Map<string, Item>();
    this.items.forEach((item, url) => {
      if (item.title && filter.test(item.title)) filtered.set(url, item);
    });
    return filtered;
  }

  constructor(private readonly items: ReadonlyMap<string, Item>) {}
}
