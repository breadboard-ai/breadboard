/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type SigninAdapter } from "../utils/signin-adapter.js";

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

export class AppCatalystApiClient {
  readonly #signinAdapter: SigninAdapter;
  readonly #apiBaseUrl: string;

  constructor(signinAdapter: SigninAdapter, apiBaseUrl: string) {
    this.#signinAdapter = signinAdapter;
    this.#apiBaseUrl = apiBaseUrl;
  }

  async chat(
    request: AppCatalystChatRequest
  ): Promise<AppCatalystChatResponse> {
    const token = await this.#signinAdapter.token();
    if (token?.state !== "valid") {
      throw new Error(`Expected "valid" token, got "${token?.state}"`);
    }
    const url = new URL("v1beta1/chatGenerateApp", this.#apiBaseUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token.grant.access_token}`,
      },
      body: JSON.stringify(request),
    });
    const result = (await response.json()) as AppCatalystChatResponse;
    return result;
  }

  async checkTos(): Promise<CheckAppAccessResponse> {
    const token = await this.#signinAdapter.token();
    if (token?.state !== "valid") {
      throw new Error(`Expected "valid" token, got "${token?.state}"`);
    }
    try {
      const result = (await (
        await fetch(new URL(`v1beta1/checkAppAccess`, this.#apiBaseUrl), {
          headers: {
            Authorization: `Bearer ${token.grant.access_token}`,
          },
        })
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
    const token = await this.#signinAdapter.token();
    if (token?.state !== "valid") {
      throw new Error(`Expected "valid" token, got "${token?.state}"`);
    }

    const url = new URL("v1beta1/acceptToS", this.#apiBaseUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token.grant.access_token}`,
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
}
