/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "@google-labs/breadboard";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

export class SecretsHelper {
  #settings: SettingsStore;
  #keys: string[] | null = null;
  #receivedSecrets: InputValues = {};

  constructor(settings: SettingsStore) {
    this.#settings = settings;
  }

  #getStoredSecrets() {
    return this.#settings.getSection(BreadboardUI.Types.SETTINGS_TYPE.SECRETS)
      .items;
  }

  setKeys(keys: string[]) {
    this.#keys = keys;
  }

  restoreStoredSecretsForKeys(keys: string[]) {
    this.setKeys(keys);

    if (!this.#keys) {
      return;
    }

    for (const key of this.#keys) {
      const secret =
        this.#settings
          ?.getSection(BreadboardUI.Types.SETTINGS_TYPE.SECRETS)
          .items.get(key) ?? null;

      this.#receivedSecrets[key] = secret?.value;
    }
  }

  static allKeysAreKnown(settings: SettingsStore, keys: string[]) {
    const result: InputValues = {};
    const allKeysAreKnown = keys.every((key) => {
      const savedSecret =
        settings
          ?.getSection(BreadboardUI.Types.SETTINGS_TYPE.SECRETS)
          .items.get(key) ?? null;
      if (savedSecret) {
        result[key] = savedSecret.value;
        return true;
      }
      return false;
    });
    if (allKeysAreKnown) return result;
    return null;
  }

  receiveSecrets(event: BreadboardUI.Events.StateEvent<"board.input">) {
    const shouldSaveSecrets =
      (event.detail.allowSavingIfSecret &&
        this.#settings
          .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
          .items.get("Save Secrets")?.value) ||
      false;
    const name = event.detail.id;
    const value = event.detail.data.secret as string;

    this.#receivedSecrets[name] = value;

    if (!shouldSaveSecrets) {
      return;
    }

    const secrets = this.#getStoredSecrets();
    let shouldSave = false;
    if (secrets.has(event.detail.id)) {
      const secret = secrets.get(event.detail.id);
      if (secret && secret.value !== value) {
        secret.value = value;
        shouldSave = true;
      }
    } else {
      secrets.set(name, { name, value });
      shouldSave = true;
    }

    if (!shouldSave) {
      return;
    }
    this.#settings.save(this.#settings.values);
  }

  hasAllSecrets(): boolean {
    if (!this.#keys) {
      return false;
    }
    for (const key of this.#keys) {
      if (!this.#receivedSecrets[key]) {
        return false;
      }
    }
    return true;
  }

  getSecrets(): InputValues {
    return this.#receivedSecrets;
  }
}
