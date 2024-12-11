/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class WeakCache<K, T extends WeakKey> {
  readonly #cache = new Map<K, WeakRef<T>>();
  readonly #finalizers = new FinalizationRegistry<K>((key) =>
    this.#cache.delete(key)
  );

  has(key: K): boolean {
    return this.#cache.has(key);
  }

  get(key: K): T | undefined {
    return this.#cache.get(key)?.deref();
  }

  set(key: K, value: T) {
    this.#cache.set(key, new WeakRef(value));
    this.#finalizers.register(value, key, { key });
  }

  getOrCreate(key: K, factory: (key: K) => T): T {
    if (this.has(key)) {
      return this.get(key)!;
    } else {
      const value = factory(key);
      this.set(key, value);
      return value;
    }
  }
}
