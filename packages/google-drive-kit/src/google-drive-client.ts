/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import { type GoogleApiAuthorization } from "./board-server/api.js";

export interface GoogleDriveClientOptions {
  apiBaseUrl: string;
  proxyUrl: string;
  getUserAccessToken: () => Promise<string>;
  publicApiKey: string;
}

interface BaseRequestOptions {
  signal?: AbortSignal;
}

export interface ReadFileOptions extends BaseRequestOptions {
  fields?: string[];
}

export class GoogleDriveClient {
  readonly #apiBaseUrl: string;
  readonly #proxyUrl: string;
  readonly #getUserAccessToken: () => Promise<string>;
  readonly #publicApiKey: string;

  constructor(options: GoogleDriveClientOptions) {
    this.#apiBaseUrl = options.apiBaseUrl;
    this.#proxyUrl = options.proxyUrl;
    this.#getUserAccessToken = options.getUserAccessToken;
    this.#publicApiKey = options.publicApiKey;
  }

  async readFile(
    fileId: string,
    options?: ReadFileOptions
  ): Promise<gapi.client.drive.File> {
    let response = await this.#readFile(fileId, options, {
      kind: "bearer",
      token: await this.#getUserAccessToken(),
    });
    if (response.status === 404) {
      response = await this.#readFile(fileId, options, {
        kind: "key",
        key: this.#publicApiKey,
      });
    }
    // TODO(aomarks) Also try falling back to the proxy.
    if (response.status === 200) {
      return response.json();
    }
    throw new Error(
      `Google Drive readFile ${response.status} error: ` +
        (await response.text())
    );
  }

  #readFile(
    fileId: string,
    options: ReadFileOptions | undefined,
    authorization: GoogleApiAuthorization
  ): Promise<Response> {
    const url = this.#makeUrl(`drive/v3/files/${fileId}`, authorization);
    if (options?.fields?.length) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    return fetch(url, {
      headers: this.#makeHeaders(authorization),
      signal: options?.signal,
    });
  }

  #makeUrl(path: string, authorization: GoogleApiAuthorization): URL {
    const url = new URL(path, this.#apiBaseUrl);
    const authKind = authorization.kind;
    if (authKind === "bearer") {
      // Nothing.
    } else if (authKind === "key") {
      url.searchParams.set("key", authorization.key);
    } else {
      throw new Error(`Unhandled authorization kind`, authKind satisfies never);
    }
    return url;
  }

  #makeHeaders(authorization: GoogleApiAuthorization): Headers {
    const headers = new Headers();
    const authKind = authorization.kind;
    if (authKind === "bearer") {
      headers.set("authorization", `Bearer ${authorization.token}`);
    } else if (authKind === "key") {
      // Nothing.
    } else {
      throw new Error(`Unhandled authorization kind`, authKind satisfies never);
    }
    return headers;
  }
}
