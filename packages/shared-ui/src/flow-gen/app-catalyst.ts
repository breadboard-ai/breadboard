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

export interface CheckAppAccessResponse {
  canAccess: boolean;
  hasAcceptedTos: boolean;
  termsOfServiceVersion: number;
}

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
    const token = await this.#signinAdapter.refresh();
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

  async checkTos(tosVersion: number = 0): Promise<boolean> {
    const token = await this.#signinAdapter.refresh();
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
      if (
        result.hasAcceptedTos &&
        result.termsOfServiceVersion === tosVersion
      ) {
        return true;
      }
    } catch (e) {
      return false;
    }

    return false;
  }

  async acceptTos(tosVersion: number = 0): Promise<void> {
    const token = await this.#signinAdapter.refresh();
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
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to accept TOS: ${response.statusText}`);
    }
  }
}
