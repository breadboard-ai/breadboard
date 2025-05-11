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

  async getFile(
    fileId: string,
    options?: ReadFileOptions
  ): Promise<gapi.client.drive.File> {
    let response = await this.#getFile(fileId, options, {
      kind: "bearer",
      token: await this.#getUserAccessToken(),
    });
    if (response.status === 404) {
      response = await this.#getFile(fileId, options, {
        kind: "key",
        key: this.#publicApiKey,
      });
    }
    if (response.status === 200) {
      return response.json();
    }

    if (response.status === 404 && this.#proxyUrl) {
      // TODO(aomarks) This is untested because the API is not available yet! It
      // almost certainly has bugs.
      //
      // TODO(aomarks) The proxy only gives us GetMedia and Export, but not just
      // a plain Get. So we're actually receiving all the file content bytes
      // here even when we don't need them. The proxy should have another mode.
      const proxyResponse = await fetch(this.#proxyUrl, {
        method: "POST",
        body: JSON.stringify({
          fileId: fileId,
          getMode: "GET_MODE_GET_MEDIA",
        } satisfies GetFileProxyRequest),
        headers: {
          authorization: `Bearer ${this.#getUserAccessToken()}`,
          ["content-type"]: "application/json",
        },
      });
      if (proxyResponse.status === 200) {
        const proxyResult =
          (await proxyResponse.json()) as GetFileProxyResponse;
        const metadata = JSON.parse(
          proxyResult.metadata
        ) as gapi.client.drive.File;
        return metadata;
      } else {
        console.log(
          `Google Drive getFile proxy ${response.status} error:`,
          await proxyResponse.text()
        );
      }
    }

    throw new Error(
      `Google Drive readFile ${response.status} error: ` +
        (await response.text())
    );
  }

  #getFile(
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

  async getFileMedia(
    fileId: string,
    options?: BaseRequestOptions
  ): Promise<Response> {
    let response = await this.#getFileMedia(fileId, options, {
      kind: "bearer",
      token: await this.#getUserAccessToken(),
    });
    if (response.status === 404) {
      response = await this.#getFileMedia(fileId, options, {
        kind: "key",
        key: this.#publicApiKey,
      });
    }
    if (response.status === 200) {
      return response;
    }

    if (response.status === 404 && this.#proxyUrl) {
      // TODO(aomarks) This is untested because the API is not available yet! It
      // almost certainly has bugs.
      const proxyResponse = await fetch(this.#proxyUrl, {
        method: "POST",
        body: JSON.stringify({
          fileId: fileId,
          getMode: "GET_MODE_GET_MEDIA",
        } satisfies GetFileProxyRequest),
        headers: {
          authorization: `Bearer ${this.#getUserAccessToken()}`,
          ["content-type"]: "application/json",
        },
      });
      if (proxyResponse.status === 200) {
        const proxyResult =
          (await proxyResponse.json()) as GetFileProxyResponse;
        const metadata = JSON.parse(
          proxyResult.metadata
        ) as gapi.client.drive.File;
        return responseFromBase64(
          proxyResult.content,
          metadata.mimeType || "application/octet-stream"
        );
      } else {
        console.log(
          `Google Drive getFileMedia proxy ${response.status} error:`,
          await proxyResponse.text()
        );
      }
    }

    throw new Error(
      `Google Drive getFileMedia ${response.status} error: ` +
        (await response.text())
    );
  }

  #getFileMedia(
    fileId: string,
    options: BaseRequestOptions | undefined,
    authorization: GoogleApiAuthorization
  ): Promise<Response> {
    const url = this.#makeUrl(`drive/v3/files/${fileId}`, authorization);
    url.searchParams.set("alt", "media");
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

type GetFileProxyRequest =
  | {
      fileId: string;
      getMode: "GET_MODE_GET_MEDIA";
    }
  | {
      fileId: string;
      getMode: "GET_MODE_EXPORT";
      mimeType: string;
    };

interface GetFileProxyResponse {
  /** JSON */
  metadata: string;
  /** base64 bytes */
  content: string;
}

function responseFromBase64(base64String: string, mimeType: string): Response {
  return new Response(
    Uint8Array.from(atob(base64String), (char) => char.charCodeAt(0)),
    { headers: { "content-type": mimeType } }
  );
}
