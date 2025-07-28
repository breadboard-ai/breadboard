/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import { retryableFetch } from "./board-server/utils.js";

type File = gapi.client.drive.File;
type Permission = gapi.client.drive.Permission;

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

export interface GetFileMetadataOptions extends BaseRequestOptions {
  fields?: Array<keyof File>;
}

export interface ExportFileOptions extends BaseRequestOptions {
  mimeType: string;
}

export type CreateFileMetadataOptions = GetFileMetadataOptions;

export type CreateFileOptions = GetFileMetadataOptions;

export interface UpdateFileOptions extends GetFileMetadataOptions {
  addParents?: string[];
  removeParents?: string[];
}

export type UpdateFileMetadataOptions = UpdateFileOptions;

export interface ListFilesOptions extends GetFileMetadataOptions {
  auth?: "user" | "apikey";
  orderBy?: Array<{
    field: keyof File;
    dir: "asc" | "desc";
  }>;
  pageSize?: number;
  pageToken?: string;
}

export interface ListFilesResponse<T extends File> {
  files: T[];
  incompleteSearch: boolean;
  kind: "drive#fileList";
  nextPageToken?: string;
}

export interface ListChangesOptions extends BaseRequestOptions {
  pageToken: string;
  pageSize?: number;
  includeRemoved?: boolean;
  includeCorpusRemovals?: boolean;
}

export type CopyFileOptions = GetFileMetadataOptions;

export interface CreatePermissionOptions extends BaseRequestOptions {
  sendNotificationEmail: boolean;
}

/** The default properties you get when requesting no fields. */
type DefaultFileFields = "id" | "kind" | "name" | "mimeType" | "resourceKey";

const DEFAULT_FILE_FIELDS: ReadonlyArray<DefaultFileFields> = [
  "id",
  "kind",
  "name",
  "mimeType",
  "resourceKey",
];

/**
 * Some properties can be undefined even when requested, either because they are
 * absent or because we don't have permission to read them.
 */
type AlwaysOptionalFileFields =
  | "permissions"
  | "properties"
  | "appProperties"
  | "resourceKey";

/**
 * A DriveFile (which usually has every field as optional) but where some of the
 * fields are required. Used when we know we are retrieving certain fields, so
 * we can assert that the values will be populated.
 */
export type NarrowedDriveFile<
  // Void here represents requesting no fields.
  T extends keyof File | void,
> = void extends T
  ? NarrowedDriveFile<DefaultFileFields>
  : MakeIntersectionTypeMoreReadable<
      {
        // Most fields will reliably be defined if requested.
        [K in keyof Omit<File, AlwaysOptionalFileFields> as K extends T
          ? K
          : never]-?: File[K];
      } & {
        // Some fields can be omitted even when requested.
        [K in AlwaysOptionalFileFields as K extends T ? K : never]?: File[K];
      }
    >;

/* eslint-disable @typescript-eslint/no-unused-vars */

// $ExpectType { name: string; ownedByMe: boolean; properties?: { [x: string]: string; } | undefined;  }
type NarrowedDriveFile_Test1 = NarrowedDriveFile<
  "name" | "ownedByMe" | "properties"
>;

// $ExpectType { id: string; kind: string; mimeType: string; name: string; resourceKey?: string | undefined; }
type NarrowedDriveFile_Test2 = NarrowedDriveFile<void>;

// $ExpectType { }
type NarrowedDriveFile_Test3 = NarrowedDriveFile<never>;

/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * A hack that usually makes intersections a bit more readable. For example,
 * `{foo: string} & {bar: number}` becomes `{foo: string, bar: number}`.
 *
 * https://github.com/microsoft/TypeScript/issues/47980#issuecomment-1049304607
 */
type MakeIntersectionTypeMoreReadable<T> = T extends unknown
  ? { [K in keyof T]: T[K] }
  : never;

type NarrowedDriveFileFromOptions<
  T extends { fields?: Array<keyof File> | undefined },
> = NarrowedDriveFile<
  T["fields"] extends Array<infer U extends keyof File> ? U : void
>;

/* eslint-disable @typescript-eslint/no-unused-vars */

// $ExpectType { name: string; ownedByMe: boolean; properties?: { [x: string]: string; } | undefined; }
type NarrowedDriveFileFromOptions_Test1 = NarrowedDriveFileFromOptions<{
  fields: Array<"name" | "ownedByMe" | "properties">;
}>;

// $ExpectType { id: string; kind: string; mimeType: string; name: string; resourceKey?: string | undefined; }
type NarrowedDriveFileFromOptions_Test2 = NarrowedDriveFileFromOptions<{
  fields: undefined;
}>;

// $ExpectType { }
type NarrowedDriveFileFromOptions_Test3 = NarrowedDriveFileFromOptions<{
  fields: [];
}>;

export type DriveFileId = { id: string; resourceKey?: string };

/* eslint-enable @typescript-eslint/no-unused-vars */

type GoogleApiAuthorization =
  | { kind: "key"; key: string }
  | { kind: "bearer"; token: string };

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

  async #fetch(
    url: string | URL,
    init?: RequestInit & {
      // We need to merge headers, and it's annoying to have to deal with the
      // other two forms of headers (array and Headers object), so only allow
      // the object style.
      headers?: Record<string, string>;
    },
    resourceKeys?: DriveFileId[],
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    authorization ??= {
      kind: "bearer",
      token: await this.#getUserAccessToken(),
    };
    const headers = this.#makeFetchHeaders(authorization, resourceKeys);
    if (init?.headers) {
      for (const [key, val] of Object.entries(init.headers)) {
        headers.set(key, val);
      }
    }
    return retryableFetch(new URL(url, this.#apiBaseUrl), {
      ...init,
      headers,
    });
  }

  #makeFetchHeaders(
    authorization: GoogleApiAuthorization,
    resourceKeys: DriveFileId[] | undefined
  ): Headers {
    const headers = new Headers();
    const authKind = authorization.kind;
    if (authKind === "bearer") {
      headers.set("authorization", `Bearer ${authorization.token}`);
    } else if (authKind === "key") {
      headers.set("X-goog-api-key", this.#publicApiKey);
      if (this.#publicApiSpoofReferer) {
        headers.set("referer", this.#publicApiSpoofReferer);
      }
    } else {
      throw new Error(`Unhandled authorization kind`, authKind satisfies never);
    }
    if (resourceKeys) {
      const resourceKeyHeader = makeResourceKeysHeaderValue(resourceKeys);
      if (resourceKeyHeader) {
        headers.set(RESOURCE_KEYS_HEADER_NAME, resourceKeyHeader);
      }
    }
    return headers;
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get#:~:text=metadata */
  async getFileMetadata<const T extends GetFileMetadataOptions>(
    fileId: DriveFileId | string,
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>> {
    fileId = normalizeFileId(fileId);

    // 1. Try directly with user credentials.
    const directResponseWithUserCreds = await this.#getFileMetadataDirectly(
      fileId,
      options
    );
    if (directResponseWithUserCreds.ok) {
      return directResponseWithUserCreds.json();
    }

    if (directResponseWithUserCreds.status === 404) {
      // 2. Try directly with a public API key.
      console.log(
        `Received 404 response for Google Drive file metadata "${fileId.id}"` +
          ` using user credentials. Now trying API key fallback.`
      );
      const directResponseWithApiKey = await this.#getFileMetadataDirectly(
        fileId,
        options,
        { kind: "key", key: this.#publicApiKey }
      );
      if (directResponseWithApiKey.ok) {
        return directResponseWithApiKey.json();
      }

      if (this.#proxyUrl) {
        // 3. Try via our custom Drive proxy service, if enabled.
        console.log(
          `Received 404 response for Google Drive file metadata "${fileId.id}"` +
            ` using API key fallback. Now trying proxy fallback.`
        );
        const proxyResponse = await this.#getFileMetadataViaProxy(
          fileId,
          this.#proxyUrl,
          options
        );
        if (proxyResponse.ok) {
          // The proxy response format is different to the direct API. Metadata is
          // nested within a "metadata" property.
          const proxyResult =
            (await proxyResponse.json()) as GetFileProxyResponse;
          return JSON.parse(proxyResult.metadata);
        } else {
          const { status } = proxyResponse;
          console.log(
            `Received ${status} response for Google Drive file metadata "${fileId.id}"` +
              ` using proxy fallback. The file is really not accessible!`
          );
        }
      }
    }

    throw new Error(
      `Google Drive getFileMetadata` +
        ` ${directResponseWithUserCreds.status} error ` +
        (await directResponseWithUserCreds.text())
    );
  }

  #getFileMetadataDirectly(
    fileId: DriveFileId,
    options: GetFileMetadataOptions | undefined,
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId.id)}`,
      this.#apiBaseUrl
    );
    if (options?.fields) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    return this.#fetch(
      url,
      { signal: options?.signal },
      [fileId],
      authorization
    );
  }

  async #getFileMetadataViaProxy(
    fileId: DriveFileId,
    proxyUrl: string,
    options: GetFileMetadataOptions | undefined
  ): Promise<Response> {
    return retryableFetch(proxyUrl, {
      method: "POST",
      body: JSON.stringify({
        fileId: fileId.id,
        // Note the proxy doesn't support resource keys. But that doesn't
        // matter, because the proxy is only used when a file is shared directly
        // with the proxy user, which means it won't require a resource key
        // (because direct account sharing never does).
        getMode: "GET_MODE_METADATA",
        metadata_fields: (options?.fields ?? DEFAULT_FILE_FIELDS).join(","),
      } satisfies GetFileProxyRequest),
      headers: {
        authorization: `Bearer ${await this.#getUserAccessToken()}`,
        ["content-type"]: "application/json",
      },
      signal: options?.signal,
    });
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get#:~:text=media */
  async getFileMedia(
    fileId: DriveFileId | string,
    options?: BaseRequestOptions
  ): Promise<Response> {
    fileId = normalizeFileId(fileId);

    // 1. Try directly with user credentials.
    const directResponseWithUserCreds = await this.#fetchFileMediaDirectly(
      fileId,
      options
    );
    if (directResponseWithUserCreds.ok) {
      return directResponseWithUserCreds;
    }

    if (directResponseWithUserCreds.status === 404) {
      // 2. Try directly with a public API key.
      console.log(
        `Received 404 response for Google Drive file media "${fileId.id}"` +
          ` using user credentials. Now trying API key fallback.`
      );
      const directResponseWithApiKey = await this.#fetchFileMediaDirectly(
        fileId,
        options,
        { kind: "key", key: this.#publicApiKey }
      );
      if (directResponseWithApiKey.ok) {
        return directResponseWithApiKey;
      }

      if (this.#proxyUrl) {
        // 3. Try via our custom Drive proxy service, if enabled.
        console.log(
          `Received 404 response for Google Drive file media "${fileId.id}"` +
            ` using public fallback, trying domain proxy fallback.`
        );
        const proxyResponse = await this.#fetchFileMediaViaProxy(
          fileId,
          this.#proxyUrl,
          options
        );
        if (proxyResponse.ok) {
          // The proxy response format is different to the direct API. The file
          // bytes and mimeType are represented as JSON, with the bytes being
          // base64 encoded.
          const proxyResult =
            (await proxyResponse.json()) as GetFileProxyResponse;
          const metadata = JSON.parse(proxyResult.metadata) as File;
          return responseFromBase64(
            proxyResult.content,
            metadata.mimeType || "application/octet-stream"
          );
        } else {
          const { status } = proxyResponse;
          console.log(
            `Received ${status} response for Google Drive file media "${fileId.id}"` +
              ` using proxy fallback. The file is really not accessible!`
          );
        }
      }
    }

    // The 404 or other error response.
    return directResponseWithUserCreds;
  }

  #fetchFileMediaDirectly(
    fileId: DriveFileId,
    options: BaseRequestOptions | undefined,
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    // TODO(aomarks) Temporarily disabled.
    // let url;
    // This is a bit hacky: we detect when we're trying to use the public
    // API key and route over to the drive proxy.
    // TODO: Make this more explicit.
    // if (authorization?.kind === "key") {
    //   url = new URL(
    //     `/files/${encodeURIComponent(fileId.id)}`,
    //     window.location.href
    //   );
    //   // Don't send the actual key: it will be provided by the proxy.
    //   authorization = undefined;
    // } else {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId.id)}`,
      this.#apiBaseUrl
    );
    // }
    url.searchParams.set("alt", "media");
    return this.#fetch(
      url,
      { signal: options?.signal },
      [fileId],
      authorization
    );
  }

  async #fetchFileMediaViaProxy(
    fileId: DriveFileId,
    proxyUrl: string,
    options: BaseRequestOptions | undefined
  ): Promise<Response> {
    return retryableFetch(proxyUrl, {
      method: "POST",
      body: JSON.stringify({
        fileId: fileId.id,
        // Resource key not needed for proxy (see other note above for details).
        getMode: "GET_MODE_GET_MEDIA",
      } satisfies GetFileProxyRequest),
      headers: {
        authorization: `Bearer ${await this.#getUserAccessToken()}`,
        ["content-type"]: "application/json",
      },
      signal: options?.signal,
    });
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export */
  async exportFile(
    fileId: DriveFileId | string,
    options: ExportFileOptions
  ): Promise<Response> {
    fileId = normalizeFileId(fileId);

    // 1. Try directly with user credentials.
    const directResponseWithUserCreds = await this.#fetchExportFileDirectly(
      fileId,
      options
    );
    if (directResponseWithUserCreds.ok) {
      return directResponseWithUserCreds;
    }

    if (directResponseWithUserCreds.status === 404) {
      // 2. Try directly with a public API key.
      console.log(
        `Received 404 response for Google Drive file export "${fileId.id}"` +
          ` using user credentials. Now trying API key fallback.`
      );
      const directResponseWithApiKey = await this.#fetchExportFileDirectly(
        fileId,
        options,
        { kind: "key", key: this.#publicApiKey }
      );
      if (directResponseWithApiKey.ok) {
        return directResponseWithApiKey;
      }

      if (this.#proxyUrl) {
        // 3. Try via our custom Drive proxy service, if enabled.
        console.log(
          `Received 404 response for Google Drive file export "${fileId.id}"` +
            ` using public fallback, trying domain proxy fallback.`
        );
        const proxyResponse = await this.#fetchExportFileViaProxy(
          fileId,
          this.#proxyUrl,
          options
        );
        if (proxyResponse.ok) {
          // The proxy response format is different to the direct API. The file
          // bytes and mimeType are represented as JSON, with the bytes being
          // base64 encoded.
          const proxyResult =
            (await proxyResponse.json()) as GetFileProxyResponse;
          return responseFromBase64(proxyResult.content, options.mimeType);
        } else {
          const { status } = proxyResponse;
          console.log(
            `Received ${status} response for Google Drive file export "${fileId.id}"` +
              ` using proxy fallback. The file is really not accessible!`
          );
        }
      }
    }

    // The 404 or other error response.
    return directResponseWithUserCreds;
  }

  #fetchExportFileDirectly(
    fileId: DriveFileId,
    options: ExportFileOptions,
    authorization?: GoogleApiAuthorization
  ): Promise<Response> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId.id)}/export`,
      this.#apiBaseUrl
    );
    url.searchParams.set("mimeType", options.mimeType);
    return this.#fetch(
      url,
      { signal: options?.signal },
      [fileId],
      authorization
    );
  }

  async #fetchExportFileViaProxy(
    fileId: DriveFileId,
    proxyUrl: string,
    options: ExportFileOptions
  ): Promise<Response> {
    return retryableFetch(proxyUrl, {
      method: "POST",
      body: JSON.stringify({
        fileId: fileId.id,
        // Resource key not needed for proxy (see other note above for details).
        getMode: "GET_MODE_EXPORT",
        mimeType: options.mimeType,
      } satisfies GetFileProxyRequest),
      headers: {
        authorization: `Bearer ${await this.#getUserAccessToken()}`,
        ["content-type"]: "application/json",
      },
      signal: options?.signal,
    });
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create#:~:text=metadata%2Donly */
  async createFileMetadata<const T extends CreateFileMetadataOptions>(
    file: File & { name: string; mimeType: string },
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>> {
    const url = new URL(`drive/v3/files`, this.#apiBaseUrl);
    if (options?.fields) {
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

  /**
   * https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create
   * https://developers.google.com/workspace/drive/api/guides/manage-uploads
   */
  async createFile<const T extends CreateFileOptions>(
    data: Blob,
    metadata?: File,
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>>;

  async createFile<const T extends CreateFileOptions>(
    data: string,
    metadata: File & { mimeType: string },
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>>;

  async createFile<const T extends CreateFileOptions>(
    data: Blob | string,
    metadata?: File,
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>> {
    const file = await this.#uploadFileMultipart(
      undefined,
      data,
      metadata,
      options
    );
    const fileId = (file as File).id;
    console.log(`[Google Drive] Created file`, {
      id: fileId,
      open: fileId ? `http://drive.google.com/open?id=${fileId}` : null,
      name: metadata?.name,
      mimeType:
        metadata?.mimeType ||
        (typeof data !== "string" ? data.type : undefined),
    });
    return file;
  }

  /**
   * https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update
   * https://developers.google.com/workspace/drive/api/guides/manage-uploads
   */
  async updateFile<const T extends UpdateFileOptions>(
    fileId: string,
    data: Blob,
    metadata?: File,
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>>;

  async updateFile<const T extends UpdateFileOptions>(
    fileId: string,
    data: string,
    metadata?: File & { mimeType: string },
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>>;

  async updateFile<const T extends UpdateFileOptions>(
    fileId: string,
    data: Blob | string,
    metadata?: File,
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>> {
    const result = this.#uploadFileMultipart(fileId, data, metadata, options);
    console.log(`[Google Drive] Updated file`, {
      id: fileId,
      open: `http://drive.google.com/open?id=${fileId}`,
      name: metadata?.name,
      mimeType:
        metadata?.mimeType ||
        (typeof data !== "string" ? data.type : undefined),
    });
    return result;
  }

  async #uploadFileMultipart<const T extends GetFileMetadataOptions>(
    fileId: string | undefined,
    data: Blob | string,
    metadata: File | undefined,
    options: T | undefined
  ): Promise<NarrowedDriveFileFromOptions<T>> {
    const isExistingFile = !!fileId;
    const isBlob = typeof data !== "string";
    if (isBlob && metadata?.mimeType && data.type !== metadata.mimeType) {
      console.warn(
        `[Google Drive] blob had type ${JSON.stringify(data.type)}` +
          ` while metadata had type ${JSON.stringify(metadata.mimeType)}.`
      );
    }

    const url = new URL(
      isExistingFile
        ? `upload/drive/v3/files/${encodeURIComponent(fileId)}`
        : `upload/drive/v3/files`,
      this.#apiBaseUrl
    );
    url.searchParams.set("uploadType", "multipart");
    if (options?.fields) {
      url.searchParams.set("fields", options.fields.join(","));
    }

    const body = new FormData();
    body.append(
      "metadata",
      new Blob([JSON.stringify(metadata ?? {})], {
        type: "application/json; charset=UTF-8",
      })
    );
    body.append("file", data);

    const response = await this.#fetch(url, {
      method: isExistingFile ? "PATCH" : "POST",
      body,
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Google Drive uploadFileMultipart ${response.status} error: ` +
          (await response.text())
      );
    }
    return response.json();
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update */
  async updateFileMetadata<const T extends UpdateFileMetadataOptions>(
    fileId: string,
    metadata: File & { parents?: never },
    options?: T
  ): Promise<NarrowedDriveFileFromOptions<T>> {
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId)}`,
      this.#apiBaseUrl
    );
    if (options?.addParents) {
      url.searchParams.set("addParents", options.addParents.join(","));
    }
    if (options?.removeParents) {
      url.searchParams.set("removeParents", options.removeParents.join(","));
    }
    if (options?.fields) {
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

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete */
  async deleteFile(
    fileId: string,
    options?: BaseRequestOptions
  ): Promise<void> {
    const response = await this.#fetch(
      `drive/v3/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE", signal: options?.signal }
    );
    if (!response.ok) {
      throw new Error(
        `Google Drive deleteFile ${response.status} error: ` +
          (await response.text())
      );
    }
  }

  async isReadable(
    fileId: DriveFileId | string,
    options?: BaseRequestOptions
  ): Promise<boolean> {
    try {
      await this.getFileMetadata(fileId, {
        fields: [],
        signal: options?.signal,
      });
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
  ): Promise<ListFilesResponse<NarrowedDriveFileFromOptions<T>>> {
    // TODO(aomarks) Make this an async iterator.
    const url = new URL(`drive/v3/files`, this.#apiBaseUrl);
    url.searchParams.set("q", query);
    if (options?.pageSize) {
      url.searchParams.set("pageSize", String(options.pageSize));
    }
    if (options?.pageToken) {
      url.searchParams.set("pageToken", options.pageToken);
    }
    if (options?.fields) {
      url.searchParams.set("fields", `files(${options.fields.join(",")})`);
    }
    if (options?.orderBy?.length) {
      url.searchParams.set(
        "orderBy",
        options.orderBy.map(({ field, dir }) => `${field} ${dir}`).join(",")
      );
    }
    const response = await this.#fetch(
      url,
      { signal: options?.signal },
      undefined,
      options?.auth === "apikey"
        ? { kind: "key", key: this.#publicApiKey }
        : undefined
    );
    if (!response.ok) {
      throw new Error(
        `Google Drive listFiles ${response.status} error: ` +
          (await response.text())
      );
    }
    return await response.json();
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create */
  async createPermission(
    fileId: string,
    permission: Permission,
    options: CreatePermissionOptions
  ): Promise<Permission> {
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
    const result = (await response.json()) as Permission;
    console.debug(
      `[Google Drive Client] Created permission ${result.id} on file ${fileId}`
    );
    return result;
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
    console.debug(
      `[Google Drive Client] Deleted permission ${permissionId}` +
        ` from file ${fileId}`
    );
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy */
  async copyFile<const T extends CopyFileOptions>(
    fileId: DriveFileId | string,
    metadata?: File,
    options?: T
  ): Promise<
    | { ok: true; value: NarrowedDriveFileFromOptions<T> }
    | { ok: false; error: { status: number } }
  > {
    fileId = normalizeFileId(fileId);
    const url = new URL(
      `drive/v3/files/${encodeURIComponent(fileId.id)}/copy`,
      this.#apiBaseUrl
    );
    if (options?.fields) {
      url.searchParams.set("fields", options.fields.join(","));
    }
    const response = await this.#fetch(url, {
      method: "POST",
      signal: options?.signal,
      body: JSON.stringify(metadata ?? {}),
    });
    return response.ok
      ? { ok: true, value: await response.json() }
      : { ok: false, error: { status: response.status } };
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken */
  async getChangesStartPageToken(
    options?: BaseRequestOptions
  ): Promise<string> {
    const response = await this.#fetch(`drive/v3/changes/startPageToken`, {
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Google Drive getChangesStartPageToken ${response.status} error: ` +
          (await response.text())
      );
    }
    const result = (await response.json()) as { startPageToken: string };
    return result.startPageToken;
  }

  /** https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list */
  async listChanges(
    options: ListChangesOptions
  ): Promise<gapi.client.drive.ChangeList> {
    const url = new URL(`drive/v3/changes`, this.#apiBaseUrl);
    url.searchParams.set("pageToken", options.pageToken);
    if (options.pageSize) {
      url.searchParams.set("pageSize", String(options.pageSize));
    }
    if (options.includeRemoved) {
      url.searchParams.set(
        "includeRemoved",
        options.includeRemoved ? "true" : "false"
      );
    }
    if (options.includeCorpusRemovals) {
      url.searchParams.set(
        "includeCorpusRemovals",
        options.includeCorpusRemovals ? "true" : "false"
      );
    }
    const response = await this.#fetch(url, { signal: options.signal });
    if (!response.ok) {
      throw new Error(
        `Google Drive listChanges ${response.status} error: ` +
          (await response.text())
      );
    }
    return response.json();
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
function onlyWritablePermissionFields(permission: Permission): Permission {
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

export function normalizeFileId(fileId: DriveFileId | string): DriveFileId {
  return typeof fileId === "string" ? { id: fileId } : fileId;
}

/** https://developers.google.com/workspace/drive/api/guides/resource-keys#syntax */
const RESOURCE_KEYS_HEADER_NAME = "X-Goog-Drive-Resource-Keys";

/** https://developers.google.com/workspace/drive/api/guides/resource-keys#syntax */
function makeResourceKeysHeaderValue(
  resourceKeys: DriveFileId[]
): string | undefined {
  const headerParts = [];
  for (const { id, resourceKey } of resourceKeys) {
    if (resourceKey && !resourceKey.match(/[/,]/) && !id.match(/[/,]/)) {
      headerParts.push(`${id}/${resourceKey}`);
    }
  }
  if (headerParts.length) {
    return headerParts.join(",");
  }
}
