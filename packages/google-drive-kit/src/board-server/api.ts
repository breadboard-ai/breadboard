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
  appProperties: Record<string, string>;
  modifiedTime?: string;
} & Properties;

export type DriveFileQuery = {
  files: DriveFile[];
};

export type Properties = {
  properties: {
    thumbnailUrl: string;
  };
};

export type AppProperties = {
  title: string;
  description: string;
  tags: GraphTag[];
  thumbnailUrl?: string;
};

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

  makeGetRequest(filename: string): Request {
    return new Request(this.#makeUrl(`drive/v3/files/${filename}`), {
      method: "GET",
      headers: this.#makeHeaders(),
    });
  }

  makeQueryRequest(query: string): Request {
    return new Request(
      this.#makeUrl(
        `drive/v3/files?q=${encodeURIComponent(query)}` +
          `&fields=files(id,name,appProperties,properties,modifiedTime)` +
          "&orderBy=modifiedTime desc"
      ),
      {
        method: "GET",
        headers: this.#makeHeaders(),
      }
    );
  }

  makeUpdateMetadataRequest(fileId: string, parent: string, metadata: unknown) {
    const headers = this.#makeHeaders();
    const url = `drive/v3/files/${fileId}?addParents=${parent}`;
    return new Request(this.#makeUrl(url), {
      method: "PATCH",
      headers,
      body: JSON.stringify(metadata),
    });
  }

  makeUploadRequest(
    fileId: string | undefined,
    data: string,
    contentType: string
  ) {
    const headers = this.#makeHeaders();
    headers.append("Content-Type", contentType);
    headers.append("X-Upload-Content-Type", contentType);
    headers.append("X-Upload-Content-Length", `${data.length}`);
    const url = fileId
      ? `upload/drive/v3/files/${fileId}?uploadType=media`
      : "upload/drive/v3/files?uploadType=media";
    return new Request(this.#makeUrl(url), {
      method: fileId ? "PATCH" : "POST",
      headers,
      body: b64toBlob(data),
    });
  }

  makeLoadRequest(file: string): Request {
    return new Request(this.#makeUrl(`drive/v3/files/${file}?alt=media`), {
      method: "GET",
      headers: this.#makeHeaders(),
    });
  }

  makeCreateRequest(body: unknown): Request {
    return new Request(this.#makeUrl(`drive/v3/files`), {
      method: "POST",
      headers: this.#makeHeaders(),
      body: JSON.stringify(body),
    });
  }

  makeMultipartCreateRequest(
    parts: Array<{ contentType: string; data: object | string }>
  ): Request {
    return new Request(
      this.#makeUrl(`upload/drive/v3/files?uploadType=multipart`),
      {
        method: "POST",
        ...this.#multipartRequest(parts),
      }
    );
  }

  makePatchRequest(
    file: string,
    parts: Array<{ contentType: string; data: object | string }>
  ): Request {
    return new Request(
      this.#makeUrl(`upload/drive/v3/files/${file}?uploadType=multipart`),
      {
        method: "PATCH",
        ...this.#multipartRequest(parts),
      }
    );
  }

  makeDeleteRequest(file: string): Request {
    return new Request(this.#makeUrl(`drive/v3/files/${file}`), {
      method: "DELETE",
      headers: this.#makeHeaders(),
    });
  }
}

function b64toBlob(b64Data: string, contentType='', sliceSize=512) {
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
    
  const blob = new Blob(byteArrays, {type: contentType});
  return blob;
}