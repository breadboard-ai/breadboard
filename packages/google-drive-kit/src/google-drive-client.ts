/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import { type GoogleApiAuthorization } from "./board-server/api.js";
import { retryableFetch } from "./board-server/utils.js";

export interface GoogleDriveClientOptions {
  apiBaseUrl: string;
  proxyUrl?: string;
  getUserAccessToken: () => Promise<string>;
  publicApiKey: string;
  publicApiSpoofReferer?: string;
}

export interface BaseRequestOptions {
  signal?: AbortSignal;
}

export interface ReadFileOptions extends BaseRequestOptions {
  fields?: Array<keyof gapi.client.drive.File>;
}

export interface UpdateFileOptions extends BaseRequestOptions {
  fields?: Array<keyof gapi.client.drive.File>;
}

export interface CopyFileOptions extends BaseRequestOptions {
  fields?: Array<keyof gapi.client.drive.File>;
}

export interface ExportFileOptions extends BaseRequestOptions {
  mimeType: string;
}

export interface WritePermissionOptions extends BaseRequestOptions {
  sendNotificationEmail: boolean;
}

export interface ListFilesOptions extends BaseRequestOptions {
  fields?: Array<keyof gapi.client.drive.File>;
  pageSize?: number;
  pageToken?: string;
}

export interface ListFilesResponse<T extends gapi.client.drive.File> {
  files: T[];
  incompleteSearch: boolean;
  kind: "drive#fileList";
  nextPageToken?: string;
}

/**
 * A DriveFile (which usually has every field as optional) but where some of the
 * fields are required. Used when we know we are retrieving certain fields, so
 * we can assert that the values will be populated.
 */
type NarrowedDriveFile<
  T extends Array<keyof gapi.client.drive.File> | undefined,
> = {
  [K in keyof Required<gapi.client.drive.File> as K extends (
    T extends Array<keyof gapi.client.drive.File>
      ? T[number]
      : // The default properties that are returned when fields is not set.
        "id" | "kind" | "name" | "mimeType"
  )
    ? K
    : // Some properties can be undefined even when requested (either because
      // they are absent or because we don't have permission to read them).
      never]: K extends "permissions" | "properties" | "appProperties"
    ? gapi.client.drive.File[K]
    : Exclude<gapi.client.drive.File[K], undefined>;
};

export class GoogleDriveClient {
  readonly #apiBaseUrl: string;
  readonly #proxyUrl?: string;
  readonly #getUserAccessToken: () => Promise<string>;
  readonly #publicApiKey: string;
  readonly #publicApiSpoofReferer?: string;

  constructor(options: GoogleDriveClientOptions) {
    this.#apiBaseUrl = options.apiBaseUrl;
    this.#proxyUrl = options.proxyUrl;
    this.#getUserAccessToken = options.getUserAccessToken;
    this.#publicApiKey = options.publicApiKey;
    this.#publicApiSpoofReferer = options.publicApiSpoofReferer;
  }

  async accessToken(): Promise<string> {
    return this.#getUserAccessToken();
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get#:~:text=metadata */
  async getFileMetadata<const T extends ReadFileOptions>(
    fileId: string,
    options?: T
  ): Promise<NarrowedDriveFile<T["fields"]>> {
    let response = await this.#getFileMetadata(fileId, options);
    if (response.status === 404) {
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using user credentials, trying public fallback.`
      );
      response = await this.#getFileMetadata(fileId, options, {
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
      const proxyResponse = await retryableFetch(this.#proxyUrl, {
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
        const metadata = JSON.parse(proxyResult.metadata);
        return metadata;
      } else if (proxyResponse.status === 500) {
        // TODO(aomarks) Remove this case once the API starts returning 404
        // errors instead of 500s when the file is not found.
        console.log(
          `Received ${proxyResponse.status} response for Google Drive file` +
            ` "${fileId}" using domain proxy fallback. Assuming file is not` +
            ` accessible.`
        );
        response = new Response(null, { status: 404 });
      } else {
        console.log(
          `Google Drive getFileMetadata proxy ${response.status} error:`,
          await proxyResponse.text()
        );
      }
    }

    throw new Error(
      `Google Drive getFileMetadata ${response.status} error: ` +
        (await response.text())
    );
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#:~:text=metadata%2Donly */
  async createFileMetadata<const T extends ReadFileOptions>(
    file: gapi.client.drive.File & { name: string; mimeType: string },
    options?: T
  ): Promise<NarrowedDriveFile<T["fields"]>> {
    const url = new URL(`drive/v3/files`, this.#apiBaseUrl);
    if (options?.fields?.length) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    const response = await this.#fetch(url, {
      method: "POST",
      body: JSON.stringify(file),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Google Drive createFileMetadata ${response.status} error: ` +
          (await response.text())
      );
    }
    return await response.json();
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update */
  async updateFileMetadata<const T extends ReadFileOptions>(
    fileId: string,
    metadata: gapi.client.drive.File,
    options?: T
  ): Promise<NarrowedDriveFile<T["fields"]>> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId)}`,
      this.#apiBaseUrl
    );
    if (options?.fields?.length) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    const response = await this.#fetch(url, {
      method: "PATCH",
      body: JSON.stringify(metadata),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Google Drive updateFileMetadata ${response.status} error: ` +
          (await response.text())
      );
    }
    return await response.json();
  }

  #getFileMetadata(
    fileId: string,
    options: ReadFileOptions | undefined,
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId)}`,
      this.#apiBaseUrl
    );
    if (options?.fields?.length) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    return this.#fetch(url, { signal: options?.signal }, authorization);
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get#:~:text=media */
  async getFileMedia(
    fileId: string,
    options?: BaseRequestOptions
  ): Promise<Response> {
    let response = await this.#getFileMedia(fileId, options);
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

    if (response.status === 404 && this.#proxyUrl) {
      console.log(
        `Received 404 response for Google Drive file "${fileId}"` +
          ` using public fallback, trying domain proxy fallback.`
      );
      const proxyResponse = await retryableFetch(this.#proxyUrl, {
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
        response = responseFromBase64(
          proxyResult.content,
          metadata.mimeType || "application/octet-stream"
        );
      } else if (proxyResponse.status === 404) {
        console.log(
          `Received 404 response for Google Drive file "${fileId}"` +
            ` using domain proxy fallback. File is not accessible.`
        );
        response = proxyResponse;
      } else if (proxyResponse.status === 500) {
        // TODO(aomarks) Remove this case once the API starts returning 404
        // errors instead of 500s when the file is not found.
        console.log(
          `Received ${proxyResponse.status} response for Google Drive file` +
            ` "${fileId}" using domain proxy fallback. Assuming file is not` +
            ` accessible.`
        );
        response = new Response(null, { status: 404 });
      } else {
        console.error(
          `Received ${proxyResponse.status} response for Google Drive file` +
            ` "${fileId}" using domain proxy fallback.`,
          await proxyResponse.text()
        );
        response = proxyResponse;
      }
    }

    return response;
  }

  #getFileMedia(
    fileId: string,
    options: BaseRequestOptions | undefined,
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId)}`,
      this.#apiBaseUrl
    );
    url.searchParams.set("alt", "media");
    return this.#fetch(url, { signal: options?.signal }, authorization);
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export */
  async exportFile(
    fileId: string,
    options: ExportFileOptions
  ): Promise<Response> {
    let response = await this.#exportFile(fileId, options);
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
      const proxyResponse = await retryableFetch(this.#proxyUrl, {
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
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId)}/export`,
      this.#apiBaseUrl
    );
    url.searchParams.set("mimeType", options.mimeType);
    return this.#fetch(url, { signal: options?.signal }, authorization);
  }

  async isReadable(
    fileId: string,
    options?: BaseRequestOptions
  ): Promise<boolean> {
    try {
      await this.getFileMetadata(fileId, options);
      return true;
    } catch {
      // TODO(aomarks) We should be a little more discerning here. Only a 404
      // should return false, anything else should be an exception.
      return false;
    }
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list */
  async listFiles<const T extends ListFilesOptions>(
    query: string,
    options?: T
  ): Promise<ListFilesResponse<NarrowedDriveFile<T["fields"]>>> {
    // TODO(aomarks) Make this an async iterator.
    const url = new URL(`drive/v3/files`, this.#apiBaseUrl);
    url.searchParams.set("q", query);
    if (options?.pageSize) {
      url.searchParams.set("pageSize", String(options.pageSize));
    }
    if (options?.pageToken) {
      url.searchParams.set("pageToken", options.pageToken);
    }
    if (options?.fields?.length) {
      url.searchParams.set("fields", `files(${options.fields.join(",")})`);
    }
    const response = await this.#fetch(url, { signal: options?.signal });
    return await response.json();
  }

  /**
   * Convenience: exactly the same as calling `getFileMetadata` and asking for
   * only permissions.
   */
  async getFilePermissions(
    fileId: string,
    options?: BaseRequestOptions
  ): Promise<gapi.client.drive.Permission[]> {
    return (
      (
        await this.getFileMetadata(fileId, {
          ...options,
          fields: ["permissions"],
        })
      ).permissions ?? []
    );
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create */
  async createPermission(
    fileId: string,
    permission: gapi.client.drive.Permission,
    options: WritePermissionOptions
  ): Promise<gapi.client.drive.Permission> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
      this.#apiBaseUrl
    );
    url.searchParams.set(
      "sendNotificationEmail",
      options.sendNotificationEmail ? "true" : "false"
    );
    const response = await this.#fetch(url, {
      method: "POST",
      body: JSON.stringify(onlyWritablePermissionFields(permission)),
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Google Drive createPermission ${response.status} error: ` +
          (await response.text())
      );
    }
    return (await response.json()) as gapi.client.drive.Permission;
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/delete */
  async deletePermission(
    fileId: string,
    permissionId: string,
    options?: BaseRequestOptions
  ): Promise<void> {
    const response = await this.#fetch(
      `drive/v3/files/${encodeURIComponent(fileId)}` +
        `/permissions/${encodeURIComponent(permissionId)}`,
      {
        method: "DELETE",
        signal: options?.signal,
      }
    );
    if (!response.ok) {
      throw new Error(
        `Google Drive deletePermission ${response.status} error: ` +
          (await response.text())
      );
    }
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy */
  async copyFile<const T extends CopyFileOptions>(
    fileId: string,
    options?: T
  ): Promise<
    | { ok: true; value: NarrowedDriveFile<T["fields"]> }
    | { ok: false; error: { status: number } }
  > {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId)}/copy`,
      this.#apiBaseUrl
    );
    if (options?.fields?.length) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    const response = await this.#fetch(url, {
      method: "POST",
      signal: options?.signal,
    });
    return response.ok
      ? { ok: true, value: await response.json() }
      : { ok: false, error: { status: response.status } };
  }

  async #fetch(
    url: string | URL,
    init?: RequestInit & {
      // We need to merge headers, and it's annoying to have to deal with the
      // other two forms of headers (array and Headers object), so only allow
      // the object style.
      headers?: Record<string, string>;
    },
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    authorization ??= {
      kind: "bearer",
      token: await this.#getUserAccessToken(),
    };
    const headers = this.#makeHeaders(authorization);
    if (init?.headers) {
      for (const [key, val] of Object.entries(init.headers)) {
        headers.set(key, val);
      }
    }
    return retryableFetch(this.#makeUrl(url, authorization), {
      ...init,
      headers,
    });
  }

  #makeUrl(path: string | URL, authorization: GoogleApiAuthorization): URL {
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
      if (this.#publicApiSpoofReferer) {
        headers.set("referer", this.#publicApiSpoofReferer);
      }
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
    { status: 200, headers: { "content-type": mimeType } }
  );
}

/**
 * Makes a copy of `permission` which only includes the fields from
 * https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions
 * that are not annotated as "output only".
 *
 * This function is helpful for syncing permissions, where we read one
 * permission and then write it to another, because the API will error if the
 * permission includes any non-writable permissions.
 */
export function onlyWritablePermissionFields(
  permission: gapi.client.drive.Permission
): gapi.client.drive.Permission {
  return {
    type: permission.type,
    emailAddress: permission.emailAddress,
    role: permission.role,
    allowFileDiscovery: permission.allowFileDiscovery,
    domain: permission.domain,
    expirationTime: permission.expirationTime,
    view: permission.view,
    pendingOwner: permission.pendingOwner,
    inheritedPermissionsDisabled: permission.inheritedPermissionsDisabled,
  };
}
