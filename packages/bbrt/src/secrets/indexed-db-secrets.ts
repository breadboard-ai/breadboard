/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resultify, type Result } from "../util/result.js";
import type { SecretsProvider } from "./secrets-provider.js";

type SecretEntry = { name: string; value: string };

export class IndexedDBSettingsSecrets implements SecretsProvider {
  async getSecret(name: string): Promise<Result<string | undefined>> {
    const allSecrets = await this.#getAllSecrets();
    return allSecrets.ok
      ? { ok: true, value: allSecrets.value[name] }
      : allSecrets;
  }

  async #getAllSecrets(): Promise<Result<Record<string, string>>> {
    const db = await resultify(indexedDB.open("settings"));
    if (!db.ok) {
      return db;
    }
    const store = resultify(() => {
      const transaction = db.value.transaction(["Secrets"]);
      return transaction.objectStore("Secrets");
    });
    if (!store.ok) {
      if ((store.error as { name?: unknown }).name === "NotFoundError") {
        return { ok: true, value: {} };
      }
      return store;
    }
    const entries = await resultify(
      store.value.getAll() as IDBRequest<SecretEntry[]>
    );
    if (!entries.ok) {
      return entries;
    }
    return {
      ok: true,
      value: Object.fromEntries(
        entries.value.map(({ name, value }) => [name, value])
      ),
    };
  }
}
