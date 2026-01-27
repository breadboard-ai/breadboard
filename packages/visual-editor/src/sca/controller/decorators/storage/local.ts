/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrimitiveType, Storage } from "../../../types.js";
import { jsonReplacer, jsonReviver } from "../../../utils/serialization.js";

export class WebStorageWrapper implements Storage {
  constructor(private backend: "local" | "session") {}

  private get store() {
    return this.backend === "local" ? localStorage : sessionStorage;
  }

  async get<T extends PrimitiveType>(name: string): Promise<T | null> {
    const raw = this.store.getItem(name);
    if (raw === null) return null;

    try {
      // JSON.parse allows "true" -> true, "100" -> 100, etc.
      return JSON.parse(raw, jsonReviver) as T;
    } catch {
      // Fallback for values that aren't valid JSON (like raw strings)
      return raw as unknown as T;
    }
  }

  async set<T extends PrimitiveType>(name: string, value: T): Promise<void> {
    this.store.setItem(name, JSON.stringify(value, jsonReplacer));
  }

  async delete(name: string) {
    this.store.removeItem(name);
  }

  // Not tested because in tests we use the in-memory storage.
  /* c8 ignore next 3 */
  async clear() {
    this.store.clear();
  }
}
