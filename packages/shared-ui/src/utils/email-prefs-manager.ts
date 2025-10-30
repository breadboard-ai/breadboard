/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalMap } from 'signal-utils/map';
import { AppCatalystApiClient } from "../flow-gen/app-catalyst.js";

const PREFERENCE_KEYS = [
  'OPAL_MARKETING_UPDATES',
  'OPAL_USER_RESEARCH',
] as const;

export type EmailPreferenceKey = (typeof PREFERENCE_KEYS)[number];

export class EmailPrefsManager {

  #apiClient: AppCatalystApiClient;

  constructor(apiClient: AppCatalystApiClient) {
    this.#apiClient = apiClient;
    this.refreshPrefs();
  }

  async refreshPrefs() {
    this.prefsValid = false;
    const prefs = await this.#apiClient.fetchEmailPreferences(PREFERENCE_KEYS);
    this.hasSetEmailPrefs = prefs.hasStoredPreferences;
    this.emailPrefs = new SignalMap(prefs.preferences);
    this.prefsValid = true;
  }

  @signal
  accessor prefsValid = false;

  @signal
  accessor hasSetEmailPrefs = false;

  @signal
  accessor emailPrefs = new SignalMap<EmailPreferenceKey, boolean>();

  updateEmailPrefs(prefs: Array<[EmailPreferenceKey, boolean]>) {
    for (const [key, value] of prefs) {
      this.emailPrefs.set(key, value);
    }
    this.#apiClient.setEmailPreferences(prefs);
  }

}