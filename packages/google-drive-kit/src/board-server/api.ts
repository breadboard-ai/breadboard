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
};

export type DriveFileQuery = {
  files: DriveFile[];
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
    const body = [
      `--${boundary}\n`,
      ...parts.map((part) => {
        const data =
          typeof part.data === "string"
            ? part.data
            : JSON.stringify(part.data, null, 2);

        return `Content-Type: ${part.contentType}\n\n${data}\n--${boundary}--`;
      }),
    ].join("\n");
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
        `drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,appProperties)`
      ),
      {
        method: "GET",
        headers: this.#makeHeaders(),
      }
    );
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
