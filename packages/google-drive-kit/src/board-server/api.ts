/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
  appProperties: {
    title: string;
    description: string;
    tags: string;
  };
};

class Files {
  readonly #accessToken: string;
  readonly #baseUrl: string;

  constructor(accessToken: string, baseUrl = "https://www.googleapis.com") {
    this.#accessToken = accessToken;
    this.#baseUrl = baseUrl;
  }

  get #headers() {
    return {
      headers: {
        Authorization: `Bearer ${this.#accessToken}`,
      },
    };
  }

  #multipartRequest(metadata: unknown, body: unknown) {
    const boundary = globalThis.crypto.randomUUID();
    const headers = new Headers({
      Authorization: `Bearer ${this.#accessToken}`,
      ["Content-Type"]: `multipart/related; boundary=${boundary}`,
    });

    const multipartBody = `--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(metadata, null, 2)}
--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(body, null, 2)}
--${boundary}--`;
    return {
      headers,
      body: multipartBody,
    };
  }

  makeGetRequest(filename: string): Request {
    return new Request(`${this.#baseUrl}/drive/v3/files/${filename}`, {
      method: "GET",
      ...this.#headers,
    });
  }

  makeQueryRequest(query: string): Request {
    return new Request(
      `${this.#baseUrl}/drive/v3/files?q=${encodeURIComponent(query)}&fields=*`,
      {
        method: "GET",
        ...this.#headers,
      }
    );
  }

  makeLoadRequest(file: string): Request {
    return new Request(`${this.#baseUrl}/drive/v3/files/${file}?alt=media`, {
      method: "GET",
      ...this.#headers,
    });
  }

  makeCreateRequest(body: unknown): Request {
    return new Request(`${this.#baseUrl}/drive/v3/files`, {
      method: "POST",
      ...this.#headers,
      body: JSON.stringify(body),
    });
  }

  makeMultipartCreateRequest(metadata: unknown, body: unknown): Request {
    return new Request(
      `${this.#baseUrl}/upload/drive/v3/files?uploadType=multipart`,
      {
        method: "POST",
        ...this.#multipartRequest(metadata, body),
      }
    );
  }

  makePatchRequest(file: string, metadata: unknown, body: unknown): Request {
    return new Request(
      `${this.#baseUrl}/upload/drive/v3/files/${file}?uploadType=multipart`,
      {
        method: "PATCH",
        ...this.#multipartRequest(metadata, body),
      }
    );
  }

  makeDeleteRequest(file: string): Request {
    return new Request(`${this.#baseUrl}/drive/v3/files/${file}`, {
      method: "DELETE",
      ...this.#headers,
    });
  }
}
