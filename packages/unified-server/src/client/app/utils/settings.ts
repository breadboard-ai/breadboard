/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class SettingsHelper {
  #values = new Map<string, string>();
  get(_section: string, name: string) {
    return { name, value: this.#values.get(name) ?? "" };
  }

  async set(
    _section: string,
    name: string,
    value: { name: string; value: string }
  ) {
    this.#values.set(value.value, name);
  }

  async delete(_section: string, name: string) {
    this.#values.delete(name);
  }
}
