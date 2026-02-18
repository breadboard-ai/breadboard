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
  // TODO(b/483555629): Switch to GOOGLE_LABS_OPAL once it's available.
  GOOGLE_NOTEBOOKLM_EVALS = "GOOGLE_NOTEBOOKLM_EVALS",
}

/** Application platform types. */
export enum ApplicationPlatform {
  WEB = "WEB",
}

/** Device types. */
export enum DeviceType {
  DESKTOP = "DESKTOP",
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

/** Request for ListNotebookPermissions RPC. */
export interface ListNotebookPermissionsRequest {
  parent: string;
  provenance: Provenance;
}

/** Response for ListNotebookPermissions RPC. */
export interface ListNotebookPermissionsResponse {
  permissions: NotebookPermission[];
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

/** Response content type for GenerateAnswer. */
export enum ResponseContentType {
  UNSPECIFIED = "TEXT_CONTENT_TYPE_UNSPECIFIED",
  MARKDOWN = "MARKDOWN",
}

/** Request for GenerateAnswer RPC. */
export interface GenerateAnswerRequest {
  /** Resource name of the ChatSession: notebooks/{notebook_id}/chatSessions/{chat_session_id} */
  name: string;
  /** The query to generate an answer for. */
  query: string;
  /** The content type of the response. */
  responseContentType: ResponseContentType;
  /** Provenance information for the API call. */
  provenance: Provenance;
}

/** Response for GenerateAnswer RPC. */
export interface GenerateAnswerResponse {
  /** The markdown content of the response. */
  markdownContent?: string;
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
  readonly #backendApiBaseUrl: string | undefined;

  constructor(
    fetchWithCreds: typeof globalThis.fetch,
    apiBaseUrl: string,
    backendApiBaseUrl?: string
  ) {
    this.#fetchWithCreds = fetchWithCreds;
    this.#apiBaseUrl = apiBaseUrl;
    this.#backendApiBaseUrl = backendApiBaseUrl;
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
    const url = this.#backendApiBaseUrl
      ? new URL(`v1beta1/nlmRetrieveRelevantChunks`, this.#backendApiBaseUrl)
      : new URL(`v1/${request.name}:retrieveRelevantChunks`, this.#apiBaseUrl);

    const body: Record<string, unknown> = {
      query: request.query,
    };
    if (this.#backendApiBaseUrl) {
      body["notebook"] = request.name;
    } else {
      body["provenance"] = request.provenance;
    }

    if (request.contextTokenBudget !== undefined) {
      body["contextTokenBudget"] = request.contextTokenBudget;
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
   * Lists all users and their access levels for a specific Notebook.
   * @param request - The request containing the parent notebook resource name
   */
  async listNotebookPermissions(
    request: ListNotebookPermissionsRequest
  ): Promise<ListNotebookPermissionsResponse> {
    // parent format: "notebooks/{notebook_id}"
    const url = new URL(`v1/${request.parent}/permissions`, this.#apiBaseUrl);

    this.#appendProvenanceParams(url, request.provenance);

    const response = await this.#fetchWithCreds(url, {
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to list notebook permissions: ${response.statusText}`
      );
    }

    return (await response.json()) as ListNotebookPermissionsResponse;
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

  /**
   * Generates an answer to a chat query using the notebook's content.
   * @param request - The request containing the query and chat session info
   */
  async generateAnswer(
    request: GenerateAnswerRequest
  ): Promise<GenerateAnswerResponse> {
    // name format: "notebooks/{notebook_id}/chatSessions/{chat_session_id}"
    const url = new URL(`v1/${request.name}:generateAnswer`, this.#apiBaseUrl);

    const body: Record<string, unknown> = {
      query: request.query,
      responseContentType: request.responseContentType,
      provenance: request.provenance,
    };

    const response = await this.#fetchWithCreds(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate answer: ${response.statusText}`);
    }

    return (await response.json()) as GenerateAnswerResponse;
  }
}
