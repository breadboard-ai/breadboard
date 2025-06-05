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
}
