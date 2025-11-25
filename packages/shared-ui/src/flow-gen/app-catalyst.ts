/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppCatalystChatRequest {
  messages: AppCatalystContentChunk[];
  appOptions: {
    format: "FORMAT_GEMINI_FLOWS";
    featureFlags?: Record<string, boolean>;
  };
}

export interface AppCatalystChatResponse {
  messages: AppCatalystContentChunk[];
}

export interface AppCatalystG1SubscriptionStatusRequest {
  include_credit_data: boolean;
}

export interface AppCatalystG1SubscriptionStatusResponse {
  is_member: boolean;
  remaining_credits: number;
}

export interface AppCatalystG1CreditsResponse {
  remaining_credits: number;
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
  UNKNOWN = "NOTIFY_PREFERENCE_UNKNOWN",
  NOTIFY = "NOTIFY_PREFERENCE_NOTIFY",
  DROP = "NOTIFY_PREFERENCE_DROP",
}

export enum NotifyConsentState {
  UNKNOWN = "NOTIFY_CONSENT_STATE_UNKNOWN",
  NOT_APPLICABLE = "NOTIFY_CONSENT_STATE_NOT_APPLICABLE",
  UNCONFIRMED = "NOTIFY_CONSENT_STATE_UNCONFIRMED",
  CONFIRMED = "NOTIFY_CONSENT_STATE_CONFIRMED",
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

  async getG1SubscriptionStatus(
    request: AppCatalystG1SubscriptionStatusRequest
  ): Promise<AppCatalystG1SubscriptionStatusResponse> {
    const url = new URL("v1beta1/getG1SubscriptionStatus", this.#apiBaseUrl);
    url.searchParams.set(
      "include_credit_data",
      String(request.include_credit_data)
    );
    const response = await this.#fetchWithCreds(url, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(
        `Failed to get G1 subscription status: ${response.statusText}`
      );
    }
    const result =
      (await response.json()) as AppCatalystG1SubscriptionStatusResponse;
    return result;
  }

  async getG1Credits(): Promise<AppCatalystG1CreditsResponse> {
    const url = new URL("v1beta1/getG1Credits", this.#apiBaseUrl);
    const response = await this.#fetchWithCreds(url, {
      method: "GET",
    });
    if (!response.ok) {
      throw new Error(`Failed to get G1 credits: ${response.statusText}`);
    }
    const result = (await response.json()) as AppCatalystG1CreditsResponse;
    return result;
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

  async fetchEmailPreferences<T extends readonly string[]>(
    preferenceKeys: T
  ): Promise<{
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
      throw new Error(
        `Failed to fetch email preferences: ${response.statusText}`
      );
    }
    const result = (await response.json()) as GetEmailPreferencesResponse;
    return {
      hasStoredPreferences:
        result.preferenceResponses?.some((pref) => pref.hasStoredPreference) ??
        false,
      preferences:
        result.preferenceResponses?.map((pref) => [
          pref.preferenceKey,
          pref.notifyPreference === NotifyPreference.NOTIFY,
        ]) ?? [],
    };
  }

  async setEmailPreferences(
    preferences: Array<[string, boolean]>
  ): Promise<void> {
    const url = new URL("v1beta1/setEmailPreferences", this.#apiBaseUrl);
    const request: SetEmailPreferencesRequest = {
      preferenceEntries: preferences.map(([key, value]) => ({
        preferenceKey: key,
        notifyPreference: value
          ? NotifyPreference.NOTIFY
          : NotifyPreference.DROP,
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
      throw new Error(
        `Failed to set email preferences: ${response.statusText}`
      );
    }
  }
}
