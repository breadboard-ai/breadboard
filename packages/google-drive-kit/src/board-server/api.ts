/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTag } from "@breadboard-ai/types";

export { Files };

export type DriveFile = {
  id: string;
  kind: string;
  mimeType: string;
  name: string;
  resourceKey: string;
  appProperties?: Record<string, string>;
  properties?: Record<string, string>;
  modifiedTime?: string;
} & Properties;

type Properties = {
  properties?: {
    thumbnailUrl?: string;
  };
};

export type AppProperties = {
  title: string;
  /** A truncated copy of the board description for listing. */
  description: string;
  tags: GraphTag[];
  thumbnailUrl?: string;
};

const CHANGE_LIST_COMMON_PARAMS = ["supportsAllDrives=true"];

export type GoogleApiAuthorization =
  | { kind: "key"; key: string }
  | { kind: "bearer"; token: string };

class Files {
  readonly #authorization: GoogleApiAuthorization;
  readonly #baseUrl: string;

  constructor(
    authorization: GoogleApiAuthorization,
    baseUrl = "https://www.googleapis.com"
  ) {
    this.#authorization = authorization;
    this.#baseUrl = baseUrl;
  }

  #makeUrl(pathAndParams: string): URL {
    const url = new URL(pathAndParams, this.#baseUrl);
    const authKind = this.#authorization.kind;
    if (authKind === "bearer") {
      // Nothing.
    } else if (authKind === "key") {
      url.searchParams.set("key", this.#authorization.key);
    } else {
      throw new Error(`Unhandled authorization kind`, authKind satisfies never);
    }
    return url;
  }

  #makeHeaders(): Headers {
    const headers = new Headers();
    const authKind = this.#authorization.kind;
    if (authKind === "bearer") {
      headers.set("authorization", `Bearer ${this.#authorization.token}`);
      // Nothing.
    } else if (authKind === "key") {
      // Nothing.
    } else {
      throw new Error(`Unhandled authorization kind`, authKind satisfies never);
    }
    return headers;
  }

  #multipartRequest(
    parts: Array<{ contentType: string; data: object | string }>
  ) {
    const boundary = globalThis.crypto.randomUUID();
    const headers = this.#makeHeaders();
    headers.set("Content-Type", `multipart/related; boundary=${boundary}`);
    const body =
      `--${boundary}\n` +
      [
        ...parts.map((part) => {
          const data =
            typeof part.data === "string"
              ? part.data
              : JSON.stringify(part.data, null, 2);

          return `Content-Type: ${part.contentType}\n\n${data}\n`;
        }),
        "",
      ].join(`\n--${boundary}`) +
      `--`;
    return {
      headers,
      body,
    };
  }

  makeUploadRequest(
    fileId: string | undefined,
    data: string | Blob,
    contentType: string
  ) {
    const isBlob = typeof data !== "string";
    const length = isBlob ? data.size : data.length;
    const body = isBlob ? data : b64toBlob(data);
    const headers = this.#makeHeaders();
    headers.append("Content-Type", contentType);
    headers.append("X-Upload-Content-Type", contentType);
    headers.append("X-Upload-Content-Length", `${length}`);
    const url = fileId
      ? `upload/drive/v3/files/${fileId}?uploadType=media`
      : "upload/drive/v3/files?uploadType=media";
    return new Request(this.#makeUrl(url), {
      method: fileId ? "PATCH" : "POST",
      headers,
      body,
    });
  }

  makeChangeListRequest(startPageToken: string | null): Request {
    const url = this.#makeUrl(
      "drive/v3/changes?" +
        CHANGE_LIST_COMMON_PARAMS.concat([
          "pageSize=1000",
          "includeRemoved=true",
          "includeCorpusRemovals=true",
          "includeItemsFromAllDrives=true",
          "spaces=drive",
          `pageToken=${startPageToken ?? "1"}`,
        ]).join("&")
    );
    return new Request(url, {
      method: "GET",
      headers: this.#makeHeaders(),
    });
  }

  makeGetStartPageTokenRequest(): Request {
    return new Request(
      this.#makeUrl(
        "drive/v3/changes/startPageToken?" + CHANGE_LIST_COMMON_PARAMS.join("&")
      ),
      {
        method: "GET",
        headers: this.#makeHeaders(),
      }
    );
  }
}

function b64toBlob(b64Data: string, contentType = "", sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
}
