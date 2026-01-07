/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { FilterableMap, TitledItem } from "../types.js";

export { FilteredMap };

class FilteredMap<Item extends TitledItem> implements FilterableMap<Item> {
  @signal
  accessor filter: string = "";

  @signal
  get results(): ReadonlyMap<string, Item> {
    const items = this.getter();
    if (!this.filter) return items;
    const filter = new RegExp(this.filter, "gim");
    const filtered = new Map<string, Item>();
    items.forEach((item, url) => {
      if (item.title && filter.test(item.title)) filtered.set(url, item);
    });
    return filtered;
  }

  constructor(private readonly getter: () => ReadonlyMap<string, Item>) {}
}