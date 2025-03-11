/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Grant {
  name: string;
  grant: string;
}

export class GrantStore {
  #grants = new Map<string, Grant>();
  get(connectionId: string) {
    return this.#grants.get(connectionId)?.grant;
  }

  async set(connectionId: string, grant: string) {
    this.#grants.set(connectionId, { name: connectionId, grant });
  }
}
