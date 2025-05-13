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

export interface BaseRequestOptions {
  signal?: AbortSignal;
}

export interface ReadFileOptions extends BaseRequestOptions {
  fields?: string[];
}

export interface ExportFileOptions extends BaseRequestOptions {
  mimeType: string;
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

  async accessToken(): Promise<string> {
    return this.#getUserAccessToken();
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
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using user credentials, trying public fallback.`
      );
      response = await this.#getFile(fileId, options, {
        kind: "key",
        key: this.#publicApiKey,
      });
    }
    if (response.status === 200) {
      return response.json();
    }

    if (response.status === 404 && this.#proxyUrl) {
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using public fallback, trying domain proxy fallback.`
      );
      const proxyResponse = await fetch(this.#proxyUrl, {
        method: "POST",
        body: JSON.stringify({
          fileId: fileId,
          getMode: "GET_MODE_METADATA",
          metadata_fields: options?.fields?.length
            ? options.fields.join(",")
            : undefined,
        } satisfies GetFileProxyRequest),
        headers: {
          authorization: `Bearer ${await this.#getUserAccessToken()}`,
          ["content-type"]: "application/json",
        },
        signal: options?.signal,
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
      // Note it is not possible to suppress the 404 error that will appear in
      // the console, so this log statement and the similar ones throughout this
      // file are here to hopefully make this look less concerning.
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using user credentials, trying public fallback.`
      );
      response = await this.#getFileMedia(fileId, options, {
        kind: "key",
        key: this.#publicApiKey,
      });
    }
    if (response.status === 200) {
      return response;
    }

    if (response.status === 404 && this.#proxyUrl) {
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using public fallback, trying domain proxy fallback.`
      );
      const proxyResponse = await fetch(this.#proxyUrl, {
        method: "POST",
        body: JSON.stringify({
          fileId: fileId,
          getMode: "GET_MODE_GET_MEDIA",
        } satisfies GetFileProxyRequest),
        headers: {
          authorization: `Bearer ${await this.#getUserAccessToken()}`,
          ["content-type"]: "application/json",
        },
        signal: options?.signal,
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

  async exportFile(
    fileId: string,
    options: ExportFileOptions
  ): Promise<Response> {
    let response = await this.#exportFile(fileId, options, {
      kind: "bearer",
      token: await this.#getUserAccessToken(),
    });
    if (response.status === 404) {
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using user credentials, trying public fallback.`
      );
      response = await this.#exportFile(fileId, options, {
        kind: "key",
        key: this.#publicApiKey,
      });
    }
    if (response.status === 200) {
      return response;
    }

    if (response.status === 404 && this.#proxyUrl) {
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using public fallback, trying domain proxy fallback.`
      );
      const proxyResponse = await fetch(this.#proxyUrl, {
        method: "POST",
        body: JSON.stringify({
          fileId: fileId,
          getMode: "GET_MODE_EXPORT",
          mimeType: options.mimeType,
        } satisfies GetFileProxyRequest),
        headers: {
          authorization: `Bearer ${await this.#getUserAccessToken()}`,
          ["content-type"]: "application/json",
        },
        signal: options?.signal,
      });
      if (proxyResponse.status === 200) {
        const proxyResult =
          (await proxyResponse.json()) as GetFileProxyResponse;
        return responseFromBase64(proxyResult.content, options.mimeType);
      } else {
        console.log(
          `Google Drive exportFile proxy ${response.status} error:`,
          await proxyResponse.text()
        );
      }
    }

    throw new Error(
      `Google Drive exportFile ${response.status} error: ` +
        (await response.text())
    );
  }

  #exportFile(
    fileId: string,
    options: ExportFileOptions,
    authorization: GoogleApiAuthorization
  ): Promise<Response> {
    const url = this.#makeUrl(`drive/v3/files/${fileId}/export`, authorization);
    url.searchParams.set("mimeType", options.mimeType);
    return fetch(url, {
      headers: this.#makeHeaders(authorization),
      signal: options?.signal,
    });
  }

  async isReadable(
    fileId: string,
    options?: BaseRequestOptions
  ): Promise<boolean> {
    try {
      await this.getFile(fileId, options);
      return true;
    } catch {
      // TODO(aomarks) We should be a little more discerning here. Only a 404
      // should return false, anything else should be an exception.
      return false;
    }
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
      metadata_fields?: string;
      getMode: "GET_MODE_METADATA";
    }
  | {
      fileId: string;
      metadata_fields?: string;
      getMode: "GET_MODE_GET_MEDIA";
    }
  | {
      fileId: string;
      metadata_fields?: string;
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
