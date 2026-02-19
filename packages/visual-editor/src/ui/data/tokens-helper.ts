/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "../index.js";
import { TokenStore } from "./tokens-store.js";

export { TokenStoreHelper };

class TokenStoreHelper implements BreadboardUI.Types.TokensHelper {
  #store: TokenStore;

  constructor(store: TokenStore) {
    this.#store = store;
  }

  get(
    section: BreadboardUI.Types.TOKEN_TYPE,
    name: string
  ): BreadboardUI.Types.TokenEntry["value"] | undefined {
    return this.#store.values[section]?.items.get(name);
  }

  async set(
    section: BreadboardUI.Types.TOKEN_TYPE,
    name: string,
    value: BreadboardUI.Types.TokenEntry["value"]
  ): Promise<void> {
    const values = this.#store.values;
    if (!values[section]) return;
    values[section].items.set(name, value);
    await this.#store.save(values);
  }

  async delete(
    section: BreadboardUI.Types.TOKEN_TYPE,
    name: string
  ): Promise<void> {
    const values = this.#store.values;
    if (!values[section]) return;
    values[section].items.delete(name);
    await this.#store.save(values);
  }
}
