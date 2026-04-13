/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared access to the `hive/` directory via File System Access API.
 *
 * Manages the directory handle, IndexedDB persistence for remembering
 * the user's choice across sessions, and the permission lifecycle.
 * Multiple consumers (LogStore, TicketStore) share a single instance.
 */

import { Signal } from "signal-polyfill";

export { StateAccess };
export type { AccessState };

type AccessState = "none" | "prompt" | "ready";

const DB_NAME = "bees-hive-handles";
const STORE_NAME = "handles";
const HANDLE_KEY = "hive-dir";

class StateAccess {
  readonly accessState = new Signal.State<AccessState>("none");
  readonly hiveName = new Signal.State<string | null>(null);

  #handle: FileSystemDirectoryHandle | null = null;

  /** The root `hive/` directory handle, available when access is "ready". */
  get handle(): FileSystemDirectoryHandle | null {
    return this.#handle;
  }

  /** Try loading a previously saved directory handle from IDB. */
  async init(): Promise<void> {
    const handle = await this.#loadHandle();
    if (!handle) {
      this.accessState.set("none");
      return;
    }
    const granted = await this.#checkPermission(handle);
    if (!granted) {
      this.accessState.set("prompt");
      return;
    }
    this.#handle = handle;
    this.hiveName.set(handle.name);
    this.accessState.set("ready");
  }

  /** Prompt the user to pick the `hive/` directory. */
  async openDirectory(): Promise<void> {
    try {
      const handle = await (
        window as unknown as {
          showDirectoryPicker(opts: {
            mode: string;
            id?: string;
          }): Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker({
        mode: "readwrite",
        // Browser remembers the last directory chosen for this ID,
        // so re-picks open to the right place automatically.
        id: "bees-hive-dir",
      });
      await this.#saveHandle(handle);
      this.#handle = handle;
      this.hiveName.set(handle.name);
      this.accessState.set("ready");
    } catch {
      // User cancelled the picker.
    }
  }

  /** Re-request permission on a previously saved handle. */
  async requestAccess(): Promise<void> {
    const handle = await this.#loadHandle();
    if (!handle) return;
    const granted = await this.#checkPermission(handle);
    if (!granted) return;
    this.#handle = handle;
    this.hiveName.set(handle.name);
    this.accessState.set("ready");
  }

  /** Resolve a subdirectory from the hive handle. */
  async getSubdirectory(
    name: string
  ): Promise<FileSystemDirectoryHandle | null> {
    if (!this.#handle) return null;
    try {
      return await this.#handle.getDirectoryHandle(name);
    } catch {
      return null;
    }
  }

  // ── IDB (no library dependency) ──

  #openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async #saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await this.#openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id: HANDLE_KEY, handle });
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  }

  async #loadHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.#openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result as
            | { handle: FileSystemDirectoryHandle }
            | undefined;
          db.close();
          resolve(result?.handle ?? null);
        };
        request.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch {
      return null;
    }
  }

  async #checkPermission(
    handle: FileSystemDirectoryHandle
  ): Promise<boolean> {
    try {
      const perm = await (
        handle as FileSystemDirectoryHandle & {
          queryPermission(opts: { mode: string }): Promise<string>;
          requestPermission(opts: { mode: string }): Promise<string>;
        }
      ).queryPermission({ mode: "readwrite" });
      if (perm === "granted") return true;

      const req = await (
        handle as FileSystemDirectoryHandle & {
          requestPermission(opts: { mode: string }): Promise<string>;
        }
      ).requestPermission({ mode: "readwrite" });
      return req === "granted";
    } catch {
      return false;
    }
  }
}
