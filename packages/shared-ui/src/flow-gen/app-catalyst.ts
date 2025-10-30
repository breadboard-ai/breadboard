/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppCatalystChatRequest {
  messages: AppCatalystContentChunk[];
  appOptions: {
    format: "FORMAT_GEMINI_FLOWS";
  };
}

export interface AppCatalystChatResponse {
  messages: AppCatalystContentChunk[];
}

export type CheckAppAccessResponse =
  | {
    canAccess: false;
    accessStatus: string;
    termsOfService?: {
      version: number;
      terms: string;
    };
  }
  | { canAccess: true; accessStatus: string };

export interface AppCatalystContentChunk {
  mimetype: "text/plain" | "text/breadboard";
  data: string;
}

export interface FetchEmailPreferencesRequest {
  preferenceKey: readonly string[];
}

export enum NotifyPreference {
  UNKNOWN = 0,
  NOTIFY = 1,
  DROP = 2,
}

export enum NotifyConsentState {
  UNKNOWN = 0,
  NOT_APPLICABLE = 1,
  UNCONFIRMED = 2,
  CONFIRMED = 3,
}

export interface FetchEmailPreferencesResponse {
  preferenceResult: Array<{
    preferenceKey: string;
    preference: NotifyPreference;
    consentState: NotifyConsentState;
  }>;
}

export interface SetEmailPreferencesRequest {
  preferenceEntry: Array<{
    preferenceKey: string;
    preference: NotifyPreference;
  }>;
}

export class AppCatalystApiClient {
  readonly #fetchWithCreds: typeof globalThis.fetch;
  readonly #apiBaseUrl: string;

  constructor(fetchWithCreds: typeof globalThis.fetch, apiBaseUrl: string) {
    this.#fetchWithCreds = fetchWithCreds;
    this.#apiBaseUrl = apiBaseUrl;
  }

  async chat(
    request: AppCatalystChatRequest
  ): Promise<AppCatalystChatResponse> {
    const url = new URL("v1beta1/chatGenerateApp", this.#apiBaseUrl);
    const response = await this.#fetchWithCreds(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
    const result = (await response.json()) as AppCatalystChatResponse;
    return result;
  }

  async checkTos(): Promise<CheckAppAccessResponse> {
    try {
      const result = (await (
        await this.#fetchWithCreds(
          new URL(`v1beta1/checkAppAccess`, this.#apiBaseUrl)
        )
      ).json()) as CheckAppAccessResponse;

      // TODO: Remove this override.
      if (result.accessStatus !== "ACCESS_STATUS_OK") {
        result.canAccess = false;
      }
      return result;
    } catch (e) {
      console.warn("[API Client]", e);
      return { canAccess: false, accessStatus: "Unable to check" };
    }
  }

  async acceptTos(tosVersion: number = 1, acceptTos = false): Promise<void> {
    const url = new URL("v1beta1/acceptToS", this.#apiBaseUrl);
    const response = await this.#fetchWithCreds(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        termsOfServiceVersion: tosVersion,
        acceptTos,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to accept TOS: ${response.statusText}`);
    }
  }

  async fetchEmailPreferences<T extends readonly string[]>(preferenceKeys: T): Promise<{
    hasStoredPreferences: boolean;
    preferences: Array<[T[number], boolean]>;
  }> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const prefs = {
      hasStoredPreferences: false,
      preferences: preferenceKeys.map((key) => [key, false]),
      ...JSON.parse(localStorage.getItem("testingEmailPrefs") ?? "{}"),
    };
    console.log('fetchEmailPreferences', prefs);
    return prefs;
    // const url = new URL("v1beta1/emailPreferences", this.#apiBaseUrl);
    // const request: FetchEmailPreferencesRequest = {
    //   preferenceKey: preferenceKeys,
    // };
    // const response = await this.#fetchWithCreds(url, {
    //   method: "GET",
    //   headers: {
    //     "content-type": "application/json",
    //   },
    //   body: JSON.stringify(request),
    // });
    // const result = (await response.json()) as FetchEmailPreferencesResponse;
    // return {
    //   hasStoredPreferences: result.preferenceResult.some(
    //     (pref) => pref.preference !== NotifyPreference.UNKNOWN
    //   ),
    //   preferences: result.preferenceResult.map((pref) => [
    //     pref.preferenceKey,
    //     pref.preference === NotifyPreference.NOTIFY
    //   ])
    // };
  }

  async setEmailPreferences(preferences: Array<[string, boolean]>): Promise<void> {
    // const url = new URL("v1beta1/emailPreferences", this.#apiBaseUrl);
    // const request: SetEmailPreferencesRequest = {
    //   preferenceEntry: preferences.map(([key, value]) => ({
    //     preferenceKey: key,
    //     preference: value ? NotifyPreference.NOTIFY : NotifyPreference.DROP,
    //   })),
    // };
    // await this.#fetchWithCreds(url, {
    //   method: "POST",
    //   headers: {
    //     "content-type": "application/json",
    //   },
    //   body: JSON.stringify(request),
    // });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const oldPrefs = JSON.parse(localStorage.getItem("testingEmailPrefs") ?? "{}");
    const prefMap = new Map(oldPrefs.preferences);
    for (const [key, value] of preferences) {
      prefMap.set(key, value);
    }
    const newPrefs = {
      hasStoredPreferences: true,
      preferences: [...prefMap.entries()],
    };
    localStorage.setItem("testingEmailPrefs", JSON.stringify(newPrefs));
    console.log('setEmailPreferences', newPrefs);
  }
}
