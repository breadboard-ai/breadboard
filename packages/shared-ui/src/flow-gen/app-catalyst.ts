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

export enum NotifyPreference {
  UNKNOWN = "UNKNOWN",
  NOTIFY = "NOTIFY",
  DROP = "DROP",
}

export enum NotifyConsentState {
  UNKNOWN = "UNKNOWN",
  NOT_APPLICABLE = "NOT_APPLICABLE",
  UNCONFIRMED = "UNCONFIRMED",
  CONFIRMED = "CONFIRMED",
}

// Represents the user preference for a given email preference key
// for the `labs_opal` Chime client
export interface EmailPreference {
  preferenceKey: string;
  notifyPreference: NotifyPreference;
  consentState?: NotifyConsentState;
  hasStoredPreference?: boolean;
}

// Request to get the email preferences for the calling user.
export interface GetEmailPreferencesRequest {
  preferenceKeys: readonly string[];
}

// Response to get the email preferences for the calling user.
export interface GetEmailPreferencesResponse {
  preferenceResponses?: EmailPreference[];
}

// Request to set the email preferences for the calling user.
export interface SetEmailPreferencesRequest {
  preferenceEntries: EmailPreference[];
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
    const url = new URL("v1beta1/getEmailPreferences", this.#apiBaseUrl);
    const request: GetEmailPreferencesRequest = {
      preferenceKeys,
    };
    const response = await this.#fetchWithCreds(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch email preferences: ${response.statusText}`);
    }
    const result = (await response.json()) as GetEmailPreferencesResponse;
    return {
      hasStoredPreferences: result.preferenceResponses?.some(
        (pref) => (
          pref.hasStoredPreference
        )
      ) ?? false,
      preferences: result.preferenceResponses?.map((pref) => [
        pref.preferenceKey,
        pref.notifyPreference === NotifyPreference.NOTIFY
      ]) ?? []
    };
  }

  async setEmailPreferences(preferences: Array<[string, boolean]>): Promise<void> {
    const url = new URL("v1beta1/setEmailPreferences", this.#apiBaseUrl);
    const request: SetEmailPreferencesRequest = {
      preferenceEntries: preferences.map(([key, value]) => ({
        preferenceKey: key,
        notifyPreference: NotifyPreference[value ? NotifyPreference.NOTIFY : NotifyPreference.DROP],
      })),
    };
    const response = await this.#fetchWithCreds(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to set email preferences: ${response.statusText}`);
    }
  }
}
