/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "@google-labs/breadboard";
import { SettingsStore } from "../data/settings-store";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

export class SecretsHelper {
  #settings: SettingsStore;
  #keys: string[];
  #receivedSecrets: InputValues = {};

  constructor(settings: SettingsStore, keys: string[] | null) {
    this.#keys = keys || [];
    this.#settings = settings;
  }

  #getStoredSecrets() {
    return this.#settings.getSection(BreadboardUI.Types.SETTINGS_TYPE.SECRETS)
      .items;
  }

  receiveSecrets(event: BreadboardUI.Events.InputEnterEvent) {
    const shouldSaveSecrets =
      (event.allowSavingIfSecret &&
        this.#settings
          .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
          .items.get("Save Secrets")?.value) ||
      false;
    if (!shouldSaveSecrets) {
      return;
    }

    const name = event.id;
    const value = event.data.secret as string;
    const secrets = this.#getStoredSecrets();
    let shouldSave = false;
    if (secrets.has(event.id)) {
      const secret = secrets.get(event.id);
      if (secret && secret.value !== value) {
        secret.value = value;
        shouldSave = true;
      }
    } else {
      secrets.set(name, { name, value });
      shouldSave = true;
    }

    this.#receivedSecrets[name] = value;

    if (!shouldSave) {
      return;
    }
    this.#settings.save(this.#settings.values);
  }

  hasAllSecrets(): boolean {
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
