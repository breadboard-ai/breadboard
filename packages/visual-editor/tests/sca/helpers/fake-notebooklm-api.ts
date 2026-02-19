/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Notebook,
  NotebookPermission,
  ListNotebooksRequest,
  ListNotebooksResponse,
  GetNotebookRequest,
  RetrieveRelevantChunksRequest,
  RetrieveRelevantChunksResponse,
  ListNotebookPermissionsRequest,
  ListNotebookPermissionsResponse,
  BatchUpdateNotebookPermissionsRequest,
  BatchUpdateNotebookPermissionsResponse,
  GenerateAnswerRequest,
  GenerateAnswerResponse,
} from "../../../src/sca/services/notebooklm-api-client.js";
import { NotebookLmApiClient } from "../../../src/sca/services/notebooklm-api-client.js";

/** Extracts only the public members of a class (strips private/protected). */
type PublicInterface<T> = { [K in keyof T]: T[K] };

/**
 * A simple in-memory fake of the NotebookLM API client for testing.
 *
 * Implements the public interface of {@link NotebookLmApiClient} so
 * that any method additions or signature changes on the real client
 * produce compile-time errors here.
 *
 * Usage:
 * ```ts
 * const fakeClient = new FakeNotebookLmApiClient();
 * fakeClient.addNotebook({ name: "notebooks/abc", displayName: "My Notebook" });
 *
 * const response = await fakeClient.listNotebooks({});
 * // response.notebooks => [{ name: "notebooks/abc", displayName: "My Notebook" }]
 *
 * fakeClient.reset();
 * ```
 *
 * Configurable behaviors:
 * - `addNotebook()` / `removeNotebook()` to manage the in-memory store.
 * - `setError()` to make the next call to any method throw.
 * - `setPermissions()` to configure permissions for a notebook.
 * - `reset()` to clear all state.
 */
export class FakeNotebookLmApiClient implements PublicInterface<NotebookLmApiClient> {
  readonly notebooks: Map<string, Notebook> = new Map();
  readonly permissions: Map<string, NotebookPermission[]> = new Map();
  readonly calls: Array<{ method: string; args: unknown[] }> = [];

  #nextError: Error | null = null;

  /**
   * Add a notebook to the fake store.
   */
  addNotebook(notebook: Notebook): void {
    this.notebooks.set(notebook.name, notebook);
  }

  /**
   * Remove a notebook from the fake store.
   */
  removeNotebook(name: string): void {
    this.notebooks.delete(name);
    this.permissions.delete(name);
  }

  /**
   * Configure permissions for a notebook.
   */
  setPermissions(notebookName: string, perms: NotebookPermission[]): void {
    this.permissions.set(notebookName, perms);
  }

  /**
   * Make the next API call throw this error, then clear.
   */
  setError(error: Error): void {
    this.#nextError = error;
  }

  /**
   * Clear all notebooks, permissions, calls, and errors.
   */
  reset(): void {
    this.notebooks.clear();
    this.permissions.clear();
    this.calls.length = 0;
    this.#nextError = null;
  }

  #recordAndMaybeThrow(method: string, args: unknown[]): void {
    this.calls.push({ method, args });
    if (this.#nextError) {
      const err = this.#nextError;
      this.#nextError = null;
      throw err;
    }
  }

  async listNotebooks(
    request: ListNotebooksRequest
  ): Promise<ListNotebooksResponse> {
    this.#recordAndMaybeThrow("listNotebooks", [request]);
    return { notebooks: [...this.notebooks.values()] };
  }

  async getNotebook(request: GetNotebookRequest): Promise<Notebook> {
    this.#recordAndMaybeThrow("getNotebook", [request]);
    const notebook = this.notebooks.get(request.name);
    if (!notebook) {
      throw new Error(`Notebook not found: ${request.name}`);
    }
    return notebook;
  }

  async retrieveRelevantChunks(
    request: RetrieveRelevantChunksRequest
  ): Promise<RetrieveRelevantChunksResponse> {
    this.#recordAndMaybeThrow("retrieveRelevantChunks", [request]);
    return { sourceContexts: [] };
  }

  async listNotebookPermissions(
    request: ListNotebookPermissionsRequest
  ): Promise<ListNotebookPermissionsResponse> {
    this.#recordAndMaybeThrow("listNotebookPermissions", [request]);
    return {
      permissions: this.permissions.get(request.parent) ?? [],
    };
  }

  async batchUpdateNotebookPermissions(
    request: BatchUpdateNotebookPermissionsRequest
  ): Promise<BatchUpdateNotebookPermissionsResponse> {
    this.#recordAndMaybeThrow("batchUpdateNotebookPermissions", [request]);

    // Store the permissions
    const existing = this.permissions.get(request.name) ?? [];
    for (const perm of request.permissions) {
      const key = "email" in perm ? perm.email : perm.gaiaId;
      const idx = existing.findIndex((p) =>
        "email" in p ? p.email === key : p.gaiaId === key
      );
      if (idx >= 0) {
        existing[idx] = perm;
      } else {
        existing.push(perm);
      }
    }
    this.permissions.set(request.name, existing);

    return {
      responses: request.permissions.map((perm) => ({
        permission: perm,
        status: { code: 0 },
      })),
    };
  }

  async generateAnswer(
    request: GenerateAnswerRequest
  ): Promise<GenerateAnswerResponse> {
    this.#recordAndMaybeThrow("generateAnswer", [request]);
    return { markdownContent: "Fake answer" };
  }
}
