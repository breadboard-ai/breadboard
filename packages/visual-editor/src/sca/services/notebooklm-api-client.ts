/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// =============================================================================
// Enums
// =============================================================================

/** Roles for Notebook access. */
export enum NotebookAccessRole {
  UNSPECIFIED = "NOTEBOOK_ACCESS_ROLE_UNSPECIFIED",
  NONE = "NOTEBOOK_ACCESS_ROLE_NONE",
  VIEWER = "NOTEBOOK_ACCESS_ROLE_VIEWER",
  EDITOR = "NOTEBOOK_ACCESS_ROLE_EDITOR",
}

/** Supported representations of a Source resource. */
export enum SourceView {
  UNSPECIFIED = "SOURCE_VIEW_UNSPECIFIED",
  BASIC = "SOURCE_VIEW_BASIC",
}

/** State of a Source. */
export enum SourceState {
  UNSPECIFIED = "STATE_UNSPECIFIED",
  PROCESSING = "PROCESSING",
  ACTIVE = "ACTIVE",
  FAILED = "FAILED",
  DELETING = "DELETING",
}

/** Blobstore file types. */
export enum BlobstoreFileType {
  UNSPECIFIED = "BLOBSTORE_FILE_TYPE_UNSPECIFIED",
  PDF = "APPLICATION_PDF",
  EPUB = "APPLICATION_EPUB",
}

/** Text content types. */
export enum TextContentType {
  UNSPECIFIED = "TEXT_CONTENT_TYPE_UNSPECIFIED",
  PLAIN_TEXT = "TEXT_CONTENT_TYPE_PLAIN_TEXT",
  MARKDOWN = "TEXT_CONTENT_TYPE_MARKDOWN",
}

/** Origin product types for provenance. */
export enum OriginProductType {
  GOOGLE_NOTEBOOKLM_EVALS = "GOOGLE_NOTEBOOKLM_EVALS",
}

/** Application platform types. */
export enum ApplicationPlatform {
  UNSPECIFIED = "APPLICATION_PLATFORM_UNSPECIFIED",
  WEB = "WEB",
  NATIVE = "NATIVE",
  BACKEND = "BACKEND",
}

/** Device types. */
export enum DeviceType {
  UNSPECIFIED = "DEVICE_UNSPECIFIED",
  MOBILE_ANDROID = "MOBILE_ANDROID",
  MOBILE_IOS = "MOBILE_IOS",
  DESKTOP = "DESKTOP",
  DESKTOP_ANDROID = "DESKTOP_ANDROID",
  OTHER = "OTHER",
}

// =============================================================================
// Types - Common
// =============================================================================

/** Client info for provenance. */
export interface ClientInfo {
  applicationPlatform: ApplicationPlatform;
  device: DeviceType;
  applicationVersion?: string;
}

/** Provenance information for API calls. */
export interface Provenance {
  originProductType: OriginProductType;
  clientInfo?: ClientInfo;
}

// =============================================================================
// Types - Source
// =============================================================================

export interface WebContent {
  url: string;
}

export interface BlobstoreContent {
  blobId: string;
  fileType: BlobstoreFileType;
}

export interface TextContent {
  content: string;
  contentType: TextContentType;
}

export interface Source {
  name: string;
  displayName?: string;
  createTime?: string;
  state?: SourceState;
  webContent?: WebContent;
  blobstoreContent?: BlobstoreContent;
  textContent?: TextContent;
}

// =============================================================================
// Types - Notebook
// =============================================================================

export interface AdvancedSettings {
  // Add fields as needed based on advanced_settings.proto
  [key: string]: unknown;
}

export interface Notebook {
  name: string;
  displayName?: string;
  createTime?: string;
  isPublic?: boolean;
  emoji?: string;
  sourceCount?: number;
  sources?: Source[];
  lastViewedTime?: string;
  advancedSettings?: AdvancedSettings;
}

export interface SourceExpansionOptions {
  view: SourceView;
}

export interface NotebookExpansion {
  sources?: SourceExpansionOptions;
}

// =============================================================================
// Types - Permissions
// =============================================================================

export type NotebookPermission =
  | { email: string; accessRole: NotebookAccessRole }
  | { gaiaId: string; accessRole: NotebookAccessRole };

export interface RpcStatus {
  code: number;
  message?: string;
  details?: unknown[];
}

export interface UpdateNotebookPermissionResponse {
  permission: NotebookPermission;
  status: RpcStatus;
}

// =============================================================================
// Types - Multimodal Content
// =============================================================================

export interface ImageReference {
  blobId?: string;
  url?: string;
  data?: string; // base64 encoded
  mimeType?: string;
}

export interface AudioReference {
  blobId?: string;
  url?: string;
  data?: string; // base64 encoded
  mimeType?: string;
}

export interface ContentPiece {
  text?: string;
  image?: ImageReference;
  audio?: AudioReference;
}

export interface MultimodalContent {
  pieces: ContentPiece[];
}

// =============================================================================
// Types - Relevant Chunks
// =============================================================================

export interface RankedContentChunk {
  content: MultimodalContent;
  globalRank: number;
}

export interface SourceContext {
  sourceName: string;
  chunks: RankedContentChunk[];
  source?: Source;
}

// =============================================================================
// Request/Response Types
// =============================================================================

/** Request for ListNotebooks RPC. */
export interface ListNotebooksRequest {
  filter?: string;
  provenance: Provenance;
  notebookExpansion?: NotebookExpansion;
}

/** Response for ListNotebooks RPC. */
export interface ListNotebooksResponse {
  notebooks: Notebook[];
}

/** Request for GetNotebook RPC. */
export interface GetNotebookRequest {
  name: string;
  provenance: Provenance;
  notebookExpansion?: NotebookExpansion;
}

/** Request for RetrieveRelevantChunks RPC. */
export interface RetrieveRelevantChunksRequest {
  name: string;
  query: string;
  contextTokenBudget?: number;
  provenance: Provenance;
}

/** Response for RetrieveRelevantChunks RPC. */
export interface RetrieveRelevantChunksResponse {
  sourceContexts: SourceContext[];
}

/** Request for BatchUpdateNotebookPermissions RPC. */
export interface BatchUpdateNotebookPermissionsRequest {
  name: string;
  permissions: NotebookPermission[];
  provenance: Provenance;
  sendEmailNotification?: boolean;
}

/** Response for BatchUpdateNotebookPermissions RPC. */
export interface BatchUpdateNotebookPermissionsResponse {
  responses: UpdateNotebookPermissionResponse[];
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Client for the NotebookLM Partner API.
 * Communicates via HTTP JSON which is translated to gRPC by OnePlatform.
 */
export class NotebookLmApiClient {
  readonly #fetchWithCreds: typeof globalThis.fetch;
  readonly #apiBaseUrl: string;

  constructor(fetchWithCreds: typeof globalThis.fetch, apiBaseUrl: string) {
    this.#fetchWithCreds = fetchWithCreds;
    this.#apiBaseUrl = apiBaseUrl;
  }

  /**
   * Appends provenance fields to URL as query parameters using dot notation.
   * E.g., provenance.originProductType=GOOGLE_NOTEBOOKLM_EVALS
   */
  #appendProvenanceParams(url: URL, provenance: Provenance): void {
    url.searchParams.set(
      "provenance.originProductType",
      provenance.originProductType
    );
    if (provenance.clientInfo) {
      url.searchParams.set(
        "provenance.clientInfo.applicationPlatform",
        provenance.clientInfo.applicationPlatform
      );
      url.searchParams.set(
        "provenance.clientInfo.device",
        provenance.clientInfo.device
      );
      if (provenance.clientInfo.applicationVersion) {
        url.searchParams.set(
          "provenance.clientInfo.applicationVersion",
          provenance.clientInfo.applicationVersion
        );
      }
    }
  }

  /**
   * Lists all Notebook resources for the current user.
   * Includes notebooks shared with the user.
   */
  async listNotebooks(
    request: ListNotebooksRequest
  ): Promise<ListNotebooksResponse> {
    const url = new URL("v1/notebooks", this.#apiBaseUrl);

    // Add filter as query param if provided
    if (request.filter) {
      url.searchParams.set("filter", request.filter);
    }

    // Add provenance as query params with dot notation
    this.#appendProvenanceParams(url, request.provenance);

    try {
      const response = await this.#fetchWithCreds(url, {
        method: "GET",
        headers: {
          "content-type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list notebooks: ${response.statusText}`);
      }

      return (await response.json()) as ListNotebooksResponse;
    } catch (err) {
      // DO NOT SUBMIT: Remove this fallback once real API is available
      console.warn("NotebookLM API unavailable, using dummy data:", err);
      return {
        notebooks: [
          {
            name: "notebooks/dummy-notebook-1",
            displayName: "My Research Notes",
            emoji: "📚",
          },
          {
            name: "notebooks/dummy-notebook-2",
            displayName: "Project Ideas",
            emoji: "💡",
          },
          {
            name: "notebooks/dummy-notebook-3",
            displayName: "Meeting Notes",
            emoji: "📝",
          },
        ],
      };
    }
  }

  /**
   * Gets details of a specific Notebook resource.
   * @param request - The request containing the notebook name (e.g. "notebooks/{id}")
   */
  async getNotebook(request: GetNotebookRequest): Promise<Notebook> {
    // name format: "notebooks/{notebook_id}"
    const url = new URL(`v1/${request.name}`, this.#apiBaseUrl);

    // Add provenance as query params with dot notation
    this.#appendProvenanceParams(url, request.provenance);

    const response = await this.#fetchWithCreds(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get notebook: ${response.statusText}`);
    }

    return (await response.json()) as Notebook;
  }

  /**
   * Returns relevant chunks of content from a notebook's sources.
   * Performs a relevance-based search against the notebook's content.
   * @param request - The request containing query and optional token budget
   */
  async retrieveRelevantChunks(
    request: RetrieveRelevantChunksRequest
  ): Promise<RetrieveRelevantChunksResponse> {
    // name format: "notebooks/{notebook_id}"
    const url = new URL(
      `v1/${request.name}:retrieveRelevantChunks`,
      this.#apiBaseUrl
    );

    const body: Record<string, unknown> = {
      query: request.query,
      provenance: request.provenance,
    };

    if (request.contextTokenBudget !== undefined) {
      body.contextTokenBudget = request.contextTokenBudget;
    }

    const response = await this.#fetchWithCreds(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to retrieve relevant chunks: ${response.statusText}`
      );
    }

    return (await response.json()) as RetrieveRelevantChunksResponse;
  }

  /**
   * Grants or updates access for users to a specific Notebook.
   * @param request - The request containing permissions to update
   */
  async batchUpdateNotebookPermissions(
    request: BatchUpdateNotebookPermissionsRequest
  ): Promise<BatchUpdateNotebookPermissionsResponse> {
    // name format: "notebooks/{notebook_id}"
    const url = new URL(
      `v1/${request.name}:batchUpdatePermissions`,
      this.#apiBaseUrl
    );

    const body: Record<string, unknown> = {
      permissions: request.permissions,
      provenance: request.provenance,
    };

    if (request.sendEmailNotification !== undefined) {
      body.sendEmailNotification = request.sendEmailNotification;
    }

    const response = await this.#fetchWithCreds(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to batch update notebook permissions: ${response.statusText}`
      );
    }

    return (await response.json()) as BatchUpdateNotebookPermissionsResponse;
  }
}
