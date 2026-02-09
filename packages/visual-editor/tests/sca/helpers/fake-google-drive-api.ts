/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "http";
import type { AddressInfo } from "net";

type DriveFile = gapi.client.drive.File;

/**
 * An HTTP server that mimics the Google Drive API using in-memory storage.
 *
 * Usage:
 * ```ts
 * const fakeApi = await FakeGoogleDriveApi.start();
 *
 * const client = new GoogleDriveClient({
 *   apiBaseUrl: fakeApi.filesApiUrl,
 *   uploadApiBaseUrl: fakeApi.uploadApiUrl,
 *   proxyApiBaseUrl: fakeApi.proxyApiUrl,
 *   fetchWithCreds: fetch,
 * });
 *
 * await client.createFile(new Blob(["content"]), { name: "test.json" });
 *
 * const metadata = await client.getFileMetadata(fileId);
 * console.log(metadata);
 *
 * await fakeApi.stop();
 * ```
 *
 * Notes:
 * - `listFiles` always returns an empty array (query parsing not implemented).
 * - All generated IDs have a `fAkE-` prefix to distinguish from real IDs.
 * - Call `reset()` in `beforeEach` to clear files, permissions, and requests.
 * - The `requests` array tracks all API calls; use it to assert request details
 *   like method, URL, and whether it was proxied.
 */
export class FakeGoogleDriveApi {
  readonly #server: ReturnType<typeof createServer>;
  readonly #host: string;
  readonly #port: number;
  readonly #files = new Map<
    string,
    { metadata: DriveFile; data?: Uint8Array }
  >();

  /**
   * Tracks all requests made to the fake API since creation or last `reset()`.
   */
  readonly requests: Array<{
    method: string;
    url: string;
    body?: string;
    wasProxied: boolean;
  }> = [];

  #generatesResourceKey = false;

  private constructor(
    server: ReturnType<typeof createServer>,
    host: string,
    port: number
  ) {
    this.#server = server;
    this.#host = host;
    this.#port = port;
  }

  /**
   * Creates and starts a fake API server.
   */
  static async start(): Promise<FakeGoogleDriveApi> {
    const host = "127.0.0.1";
    const port = 0; // random
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.on("error", reject);
      server.listen(port, host, () => {
        const address = server.address() as AddressInfo;
        const instance = new FakeGoogleDriveApi(server, host, address.port);
        server.on("request", (req, res) => instance.#routeRequest(req, res));
        resolve(instance);
      });
    });
  }

  /**
   * Stops the fake API server.
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.#server.close(() => resolve());
    });
  }

  /**
   * The base URL for the main Drive Files API.
   */
  get filesApiUrl(): string {
    return `http://${this.#host}:${this.#port}/drive/v3/files`;
  }

  /**
   * The base URL for the Drive Upload API.
   */
  get uploadApiUrl(): string {
    return `http://${this.#host}:${this.#port}/upload/drive/v3/files`;
  }

  /**
   * The base URL for the Proxy API (simulates public proxy access).
   */
  get proxyApiUrl(): string {
    return `http://${this.#host}:${this.#port}/proxy/drive/v3/files`;
  }

  /**
   * Clear all configured data and request tracking.
   */
  reset(): void {
    this.#files.clear();
    this.requests.length = 0;
    this.#generatesResourceKey = false;
  }

  /**
   * Force-set arbitrary metadata fields on a file.
   * This is useful for test setups where you need to configure
   * properties that aren't normally settable via the client API,
   * such as setting `ownedByMe: false`.
   */
  forceSetFileMetadata(fileId: string, metadata: Partial<DriveFile>): void {
    const file = this.#files.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }
    Object.assign(file.metadata, metadata);
  }

  /**
   * Configure whether createFile automatically generates a resourceKey.
   * When enabled, all subsequent createFile calls will include a resourceKey
   * until disabled. Resets to `false` when `reset()` is called.
   */
  createFileGeneratesResourceKey(generates: boolean): void {
    this.#generatesResourceKey = generates;
  }

  async #routeRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const body = await this.#readBody(req);

    // Detect and strip /proxy/ prefix for routing. The client uses a separate
    // proxy URL to access public files without credentials, so we track which
    // requests came through that path for test assertions.
    const proxyPrefix = "/proxy";
    const originalUrl = req.url ?? "";
    const hasProxyPrefix = originalUrl.startsWith(proxyPrefix + "/");
    const routingUrl = hasProxyPrefix
      ? originalUrl.slice(proxyPrefix.length)
      : originalUrl;

    this.requests.push({
      method: req.method ?? "GET",
      url: originalUrl,
      body: new TextDecoder().decode(body) || undefined,
      wasProxied: hasProxyPrefix,
    });

    const url = new URL(routingUrl, `http://${this.#host}:${this.#port}`);

    // /drive/v3/files
    const filesMatch = new URLPattern({ pathname: "/drive/v3/files" }).test(
      url
    );
    if (filesMatch) {
      if (req.method === "GET") {
        return this.#handleListFiles(url, res);
      }
      if (req.method === "POST") {
        return this.#handleCreateFileMetadata(body, url, res);
      }
    }

    // /drive/v3/files/generateIds (must precede :fileId because it's ambiguous)
    if (
      new URLPattern({ pathname: "/drive/v3/files/generateIds" }).test(url) &&
      req.method === "GET"
    ) {
      return this.#handleGenerateIds(url, res);
    }

    // /drive/v3/files/:fileId
    const fileMatch = new URLPattern({
      pathname: "/drive/v3/files/:fileId",
    }).exec(url);
    if (fileMatch) {
      const fileId = fileMatch.pathname.groups.fileId!;
      if (req.method === "GET") {
        if (url.searchParams.get("alt") === "media") {
          return this.#handleGetFileMedia(fileId, res);
        }
        return this.#handleGetFileMetadata(fileId, url, res);
      }
      if (req.method === "PATCH") {
        return this.#handleUpdateFileMetadata(fileId, body, url, res);
      }
      if (req.method === "DELETE") {
        return this.#handleDeleteFile(fileId, res);
      }
    }

    // /drive/v3/files/:fileId/copy
    const copyMatch = new URLPattern({
      pathname: "/drive/v3/files/:fileId/copy",
    }).exec(url);
    if (copyMatch && req.method === "POST") {
      const fileId = copyMatch.pathname.groups.fileId!;
      return this.#handleCopyFile(fileId, body, url, res);
    }

    // /drive/v3/files/:fileId/export
    const exportMatch = new URLPattern({
      pathname: "/drive/v3/files/:fileId/export",
    }).exec(url);
    if (exportMatch && req.method === "GET") {
      const fileId = exportMatch.pathname.groups.fileId!;
      return this.#handleExportFile(fileId, url, res);
    }

    // /drive/v3/files/:fileId/permissions
    const permissionsMatch = new URLPattern({
      pathname: "/drive/v3/files/:fileId/permissions",
    }).exec(url);
    if (permissionsMatch && req.method === "POST") {
      const fileId = permissionsMatch.pathname.groups.fileId!;
      return this.#handleCreatePermission(fileId, body, res);
    }

    // /drive/v3/files/:fileId/permissions/:permissionId
    const deletePermissionMatch = new URLPattern({
      pathname: "/drive/v3/files/:fileId/permissions/:permissionId",
    }).exec(url);
    if (deletePermissionMatch && req.method === "DELETE") {
      const fileId = deletePermissionMatch.pathname.groups.fileId!;
      const permissionId = deletePermissionMatch.pathname.groups.permissionId!;
      return this.#handleDeletePermission(fileId, permissionId, res);
    }

    // /upload/drive/v3/files
    if (
      new URLPattern({ pathname: "/upload/drive/v3/files" }).test(url) &&
      req.method === "POST"
    ) {
      return this.#handleCreateFile(body, req.headers, url, res);
    }

    // /upload/drive/v3/files/:fileId
    const updateMatch = new URLPattern({
      pathname: "/upload/drive/v3/files/:fileId",
    }).exec(url);
    if (updateMatch && req.method === "PATCH") {
      const fileId = updateMatch.pathname.groups.fileId!;
      return this.#handleUpdateFile(fileId, body, req.headers, url, res);
    }

    this.#errorResponse(res, 404, "Not Found");
  }

  // /drive/v3/files
  #handleListFiles(url: URL, res: ServerResponse): void {
    const query = url.searchParams.get("q");
    if (!query) {
      this.#errorResponse(res, 400, "Missing required 'q' parameter");
      return;
    }
    console.warn(
      `[FakeGoogleDriveApi] listFiles called with query "${query}". ` +
        `Query language is not implemented; returning empty array.`
    );
    this.#jsonResponse(res, { files: [] });
  }

  #handleCreateFileMetadata(
    body: Uint8Array,
    url: URL,
    res: ServerResponse
  ): void {
    const metadata: DriveFile = JSON.parse(new TextDecoder().decode(body));
    const newFileId = metadata.id ?? this.#generateFakeFileId();

    const fileMetadata: DriveFile = {
      id: newFileId,
      kind: "drive#file",
      ownedByMe: true,
      version: "1",
      properties: {},
      ...metadata,
    };
    this.#files.set(newFileId, { metadata: fileMetadata });

    const response = this.#filterFields(fileMetadata, url);
    this.#jsonResponse(res, response);
  }

  // /drive/v3/files/generateIds
  #handleGenerateIds(url: URL, res: ServerResponse): void {
    const countParam = url.searchParams.get("count");
    const count = countParam ? parseInt(countParam, 10) : 1;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.#generateFakeFileId());
    }
    this.#jsonResponse(res, {
      ids,
      kind: "drive#generatedIds",
      space: "drive",
    });
  }

  // /drive/v3/files/:fileId
  #handleGetFileMetadata(fileId: string, url: URL, res: ServerResponse): void {
    const file = this.#files.get(fileId);

    if (!file) {
      this.#errorResponse(res, 404, `File not found: ${fileId}`);
      return;
    }

    const fieldsParam = url.searchParams.get("fields");
    let response: DriveFile = file.metadata;
    if (fieldsParam) {
      const fields = fieldsParam.split(",");
      response = {} as DriveFile;
      for (const field of fields) {
        const key = field.trim() as keyof DriveFile;
        if (key in file.metadata) {
          (response as Record<string, unknown>)[key] = file.metadata[key];
        }
      }
    }

    this.#jsonResponse(res, response);
  }

  #handleGetFileMedia(fileId: string, res: ServerResponse): void {
    const file = this.#files.get(fileId);

    if (!file) {
      this.#errorResponse(res, 404, `File not found: ${fileId}`);
      return;
    }

    const mimeType = file.metadata.mimeType ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(Buffer.from(file.data ?? new Uint8Array(0)));
  }

  #handleUpdateFileMetadata(
    fileId: string,
    body: Uint8Array,
    url: URL,
    res: ServerResponse
  ): void {
    const existingFile = this.#files.get(fileId);
    if (!existingFile) {
      this.#errorResponse(res, 404, "File not found");
      return;
    }

    const metadata: DriveFile = JSON.parse(new TextDecoder().decode(body));
    const currentVersion = parseInt(existingFile.metadata.version ?? "1", 10);
    // Deep merge properties to avoid losing existing properties when only some are updated
    const updatedMetadata: DriveFile = {
      ...existingFile.metadata,
      ...metadata,
      properties: {
        ...existingFile.metadata.properties,
        ...metadata.properties,
      },
      id: fileId,
      version: String(currentVersion + 1),
    };

    this.#files.set(fileId, { ...existingFile, metadata: updatedMetadata });
    const response = this.#filterFields(updatedMetadata, url);

    this.#jsonResponse(res, response);
  }

  #handleDeleteFile(fileId: string, res: ServerResponse): void {
    const file = this.#files.get(fileId);
    if (!file) {
      this.#errorResponse(res, 404, "File not found");
      return;
    }

    this.#files.delete(fileId);

    // Google Drive returns empty response for delete
    res.writeHead(204);
    res.end();
  }

  // /drive/v3/files/:fileId/copy
  #handleCopyFile(
    fileId: string,
    body: Uint8Array,
    url: URL,
    res: ServerResponse
  ): void {
    const sourceFile = this.#files.get(fileId);

    if (!sourceFile) {
      this.#errorResponse(res, 404, `File not found: ${fileId}`);
      return;
    }

    const newMetadata: DriveFile = body.length
      ? JSON.parse(new TextDecoder().decode(body))
      : {};
    const newFileId = this.#generateFakeFileId();

    const copiedFileMetadata: DriveFile = {
      ...sourceFile.metadata,
      ...newMetadata,
      id: newFileId,
      version: "1",
    };
    this.#files.set(newFileId, {
      metadata: copiedFileMetadata,
      data: sourceFile.data,
    });

    const response = this.#filterFields(copiedFileMetadata, url);
    this.#jsonResponse(res, response);
  }

  // /drive/v3/files/:fileId/export
  #handleExportFile(fileId: string, url: URL, res: ServerResponse): void {
    const mimeType = url.searchParams.get("mimeType");
    if (!mimeType) {
      this.#errorResponse(res, 400, "Required parameter: mimeType");
      return;
    }

    const file = this.#files.get(fileId);

    if (!file) {
      this.#errorResponse(res, 404, `File not found: ${fileId}`);
      return;
    }

    // For the fake, just return the file content as-is
    // Real export would convert to the requested mimeType
    const content = file.data ?? new Uint8Array();
    res.writeHead(200, {
      "Content-Type": mimeType,
    });
    res.end(Buffer.from(content));
  }

  // /drive/v3/files/:fileId/permissions
  #handleCreatePermission(
    fileId: string,
    body: Uint8Array,
    res: ServerResponse
  ): void {
    const file = this.#files.get(fileId);
    if (!file) {
      this.#errorResponse(res, 404, "File not found");
      return;
    }

    const permission: gapi.client.drive.Permission = JSON.parse(
      new TextDecoder().decode(body)
    );
    const permissionWithId = {
      ...permission,
      id: this.#generateFakePermissionId(),
    };

    if (!file.metadata.permissions) {
      file.metadata.permissions = [];
    }
    file.metadata.permissions.push(permissionWithId);

    this.#jsonResponse(res, permissionWithId);
  }

  // /drive/v3/files/:fileId/permissions/:permissionId
  #handleDeletePermission(
    fileId: string,
    permissionId: string,
    res: ServerResponse
  ): void {
    const file = this.#files.get(fileId);
    if (!file) {
      this.#errorResponse(res, 404, "File not found");
      return;
    }

    if (!file.metadata.permissions) {
      this.#errorResponse(res, 404, "Permission not found");
      return;
    }

    const permIndex = file.metadata.permissions.findIndex(
      (p) => p.id === permissionId
    );
    if (permIndex === -1) {
      this.#errorResponse(res, 404, "Permission not found");
      return;
    }

    file.metadata.permissions.splice(permIndex, 1);

    // Google Drive returns empty response for delete
    res.writeHead(204);
    res.end();
  }

  // /upload/drive/v3/files
  async #handleCreateFile(
    body: Uint8Array,
    headers: IncomingHttpHeaders,
    url: URL,
    res: ServerResponse
  ): Promise<void> {
    const { metadata, data } = await this.#parseMultipartBody(body, headers);
    // Use client-provided ID if present (e.g., from generateIds), otherwise generate one
    const fileId = metadata.id ?? this.#generateFakeFileId();

    const fileMetadata: DriveFile = {
      id: fileId,
      kind: "drive#file",
      ownedByMe: true,
      version: "1",
      properties: {},
      permissions: [],
      ...(this.#generatesResourceKey && {
        resourceKey: this.#generateFakeResourceKey(),
      }),
      ...metadata,
    };
    this.#files.set(fileId, { metadata: fileMetadata, data });
    const response = this.#filterFields(fileMetadata, url);

    this.#jsonResponse(res, response);
  }

  // /upload/drive/v3/files/:fileId
  async #handleUpdateFile(
    fileId: string,
    body: Uint8Array,
    headers: IncomingHttpHeaders,
    url: URL,
    res: ServerResponse
  ): Promise<void> {
    const { metadata, data } = await this.#parseMultipartBody(body, headers);

    const existingFile = this.#files.get(fileId);
    if (!existingFile) {
      this.#errorResponse(res, 404, "File not found");
      return;
    }

    // Deep merge properties to avoid losing existing properties when only some are updated
    const updatedMetadata: DriveFile = {
      ...existingFile.metadata,
      ...metadata,
      properties: {
        ...existingFile.metadata.properties,
        ...metadata.properties,
      },
      id: fileId,
    };

    this.#files.set(fileId, { metadata: updatedMetadata, data });

    const response = this.#filterFields(updatedMetadata, url);

    this.#jsonResponse(res, response);
  }

  async #parseMultipartBody(
    body: Uint8Array,
    headers: IncomingHttpHeaders
  ): Promise<{
    metadata: DriveFile;
    data: Uint8Array;
  }> {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: headers as HeadersInit,
      body: new Blob([body.buffer as ArrayBuffer]),
    });

    const formData = await request.formData();
    const metadataBlob = formData.get("metadata") as Blob | null;
    const fileBlob = formData.get("file") as Blob | null;

    const metadata: DriveFile = metadataBlob
      ? JSON.parse(await metadataBlob.text())
      : {};
    const data = fileBlob
      ? new Uint8Array(await fileBlob.arrayBuffer())
      : new Uint8Array(0);

    return { metadata, data };
  }

  #filterFields(metadata: DriveFile, url: URL): DriveFile {
    const fieldsParam = url.searchParams.get("fields");
    if (!fieldsParam) {
      return metadata;
    }

    const fields = fieldsParam.split(",");
    const response = {} as DriveFile;
    for (const field of fields) {
      const key = field.trim() as keyof DriveFile;
      if (key in metadata) {
        (response as Record<string, unknown>)[key] = metadata[key];
      }
    }
    return response;
  }

  async #readBody(req: IncomingMessage): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    });
  }

  #jsonResponse(res: ServerResponse, data: unknown): void {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  #errorResponse(res: ServerResponse, code: number, message: string): void {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message, code } }));
  }

  #generateFakeId(prefix: string, length: number, alphabet: string): string {
    const remainingLength = length - prefix.length;
    let id = prefix;
    for (let i = 0; i < remainingLength; i++) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return id;
  }

  #generateFakeFileId(): string {
    return this.#generateFakeId(
      "fAkE-",
      44,
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    );
  }

  #generateFakeResourceKey(): string {
    return this.#generateFakeId(
      "fAkE-rK-",
      32,
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    );
  }

  #generateFakePermissionId(): string {
    return this.#generateFakeId("12345", 20, "0123456789");
  }
}
