/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleDriveClientOptions {
  apiBaseUrl: string;
  proxyUrl: string;
  getUserCredentials: () => Promise<string | undefined>;
  publicApiKey: string;
}

export class GoogleDriveClient {
  readonly #apiBaseUrl: string;
  readonly #proxyUrl: string;
  readonly #getUserCredentials: () => Promise<string | undefined>;
  readonly #publicApiKey: string;

  constructor(options: GoogleDriveClientOptions) {
    this.#apiBaseUrl = options.apiBaseUrl;
    this.#proxyUrl = options.proxyUrl;
    this.#getUserCredentials = options.getUserCredentials;
    this.#publicApiKey = options.publicApiKey;
  }
}
