/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared access to the `hive/` directory via File System Access API.
 *
 * Manages a registry of directory handles in IndexedDB, allowing
 * the user to add, remove, and switch between multiple hive directories.
 * Multiple consumers (LogStore, TicketStore) share a single instance.
 */

import { Signal } from "signal-polyfill";

export { StateAccess };
export type { AccessState, HiveEntry };

type AccessState = "none" | "prompt" | "ready";

/** A registered hive directory (UI-facing, no handle). */
interface HiveEntry {
  readonly id: string;
  readonly name: string;
  readonly addedAt: number;
}

const DB_NAME = "bees-hive-handles";
const STORE_NAME = "handles";

// IDB key conventions.
const HIVE_PREFIX = "hive:";
const ACTIVE_KEY = "active-hive";
const LEGACY_KEY = "hive-dir";

class StateAccess {
  readonly accessState = new Signal.State<AccessState>("none");
  readonly hiveName = new Signal.State<string | null>(null);

  /** All registered hives (for the picker UI). */
  readonly hives = new Signal.State<HiveEntry[]>([]);

  /** ID of the currently active hive. */
  readonly activeHiveId = new Signal.State<string | null>(null);

  #handle: FileSystemDirectoryHandle | null = null;

  /** The root `hive/` directory handle, available when access is "ready". */
  get handle(): FileSystemDirectoryHandle | null {
    return this.#handle;
  }

  /**
   * Load the hive registry from IDB, migrate legacy entries, and
   * attempt to activate the most recent hive.
   */
  async init(): Promise<void> {
    await this.#migrateLegacy();
    const entries = await this.#loadAllEntries();
    this.hives.set(entries);

    const activeId = await this.#loadActiveId();
    const target = entries.find((e) => e.id === activeId) ?? entries[0];

    if (!target) {
      this.accessState.set("none");
      return;
    }

    await this.#activate(target);
  }

  /**
   * Open the directory picker, register the chosen directory, and
   * switch to it. Returns true if a hive was added.
   */
  async addHive(): Promise<boolean> {
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
        id: "bees-hive-dir",
      });

      const id = crypto.randomUUID();
      const addedAt = Date.now();

      await this.#saveEntry(id, handle, handle.name, addedAt);
      await this.#saveActiveId(id);

      const entry: HiveEntry = { id, name: handle.name, addedAt };
      this.hives.set([...this.hives.get(), entry]);

      this.#handle = handle;
      this.hiveName.set(handle.name);
      this.activeHiveId.set(id);
      this.accessState.set("ready");
      return true;
    } catch {
      // User cancelled the picker.
      return false;
    }
  }

  /** Remove a hive from the registry. */
  async removeHive(id: string): Promise<void> {
    await this.#deleteEntry(id);
    const remaining = this.hives.get().filter((e) => e.id !== id);
    this.hives.set(remaining);

    if (this.activeHiveId.get() === id) {
      if (remaining.length > 0) {
        await this.#activate(remaining[0], true);
      } else {
        this.#handle = null;
        this.hiveName.set(null);
        this.activeHiveId.set(null);
        await this.#saveActiveId(null);
        this.accessState.set("none");
      }
    }
  }

  /** Switch to a previously registered hive. */
  async switchToHive(id: string): Promise<void> {
    const entry = this.hives.get().find((e) => e.id === id);
    if (!entry) return;
    await this.#activate(entry, true);
  }

  /** Re-request permission on the current hive. */
  async requestAccess(): Promise<void> {
    const activeId = this.activeHiveId.get();
    if (!activeId) return;
    const handle = await this.#loadHandle(activeId);
    if (!handle) return;

    const granted = await this.#checkPermission(handle);
    if (!granted) return;

    this.#handle = handle;
    this.hiveName.set(handle.name);
    this.accessState.set("ready");
  }

  /** Resolve a subdirectory from the hive handle. */
  async getSubdirectory(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemDirectoryHandle | null> {
    if (!this.#handle) return null;
    try {
      return await this.#handle.getDirectoryHandle(name, options);
    } catch {
      return null;
    }
  }

  // ── Activation ──

  async #activate(entry: HiveEntry, saveActive = false): Promise<void> {
    const handle = await this.#loadHandle(entry.id);
    if (!handle) {
      // Handle was invalidated by the browser; remove from registry.
      await this.removeHive(entry.id);
      return;
    }

    if (saveActive) await this.#saveActiveId(entry.id);
    this.activeHiveId.set(entry.id);

    const granted = await this.#checkPermission(handle);
    if (!granted) {
      this.accessState.set("prompt");
      return;
    }

    this.#handle = handle;
    this.hiveName.set(entry.name);
    this.accessState.set("ready");
  }

  // ── Legacy migration ──

  async #migrateLegacy(): Promise<void> {
    const db = await this.#openDB();
    try {
      const record = await idbGet<{ handle: FileSystemDirectoryHandle }>(
        db,
        LEGACY_KEY,
      );
      if (!record?.handle) return;

      const id = crypto.randomUUID();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: `${HIVE_PREFIX}${id}`,
        handle: record.handle,
        name: record.handle.name,
        addedAt: Date.now(),
      });
      store.put({ id: ACTIVE_KEY, hiveId: id });
      store.delete(LEGACY_KEY);
      await idbCommit(tx);
    } finally {
      db.close();
    }
  }

  // ── IDB helpers ──

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

  async #saveEntry(
    id: string,
    handle: FileSystemDirectoryHandle,
    name: string,
    addedAt: number,
  ): Promise<void> {
    const db = await this.#openDB();
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        id: `${HIVE_PREFIX}${id}`,
        handle,
        name,
        addedAt,
      });
      await idbCommit(tx);
    } finally {
      db.close();
    }
  }

  async #deleteEntry(id: string): Promise<void> {
    const db = await this.#openDB();
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(`${HIVE_PREFIX}${id}`);
      await idbCommit(tx);
    } finally {
      db.close();
    }
  }

  async #loadHandle(
    id: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    const db = await this.#openDB();
    try {
      const record = await idbGet<{
        handle: FileSystemDirectoryHandle;
      }>(db, `${HIVE_PREFIX}${id}`);
      return record?.handle ?? null;
    } finally {
      db.close();
    }
  }

  async #loadAllEntries(): Promise<HiveEntry[]> {
    const db = await this.#openDB();
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      const all = await idbRequest<
        Array<{ id: string; name?: string; addedAt?: number }>
      >(request);
      return (all ?? [])
        .filter((r) => r.id.startsWith(HIVE_PREFIX))
        .map((r) => ({
          id: r.id.slice(HIVE_PREFIX.length),
          name: r.name ?? "unknown",
          addedAt: r.addedAt ?? 0,
        }))
        .sort((a, b) => a.addedAt - b.addedAt);
    } finally {
      db.close();
    }
  }

  async #loadActiveId(): Promise<string | null> {
    const db = await this.#openDB();
    try {
      const record = await idbGet<{ hiveId: string }>(db, ACTIVE_KEY);
      return record?.hiveId ?? null;
    } finally {
      db.close();
    }
  }

  async #saveActiveId(id: string | null): Promise<void> {
    const db = await this.#openDB();
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      if (id) {
        tx.objectStore(STORE_NAME).put({ id: ACTIVE_KEY, hiveId: id });
      } else {
        tx.objectStore(STORE_NAME).delete(ACTIVE_KEY);
      }
      await idbCommit(tx);
    } finally {
      db.close();
    }
  }

  async #checkPermission(
    handle: FileSystemDirectoryHandle,
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

// ── Minimal IDB promise wrappers ──

function idbRequest<T>(request: IDBRequest): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  const tx = db.transaction(STORE_NAME, "readonly");
  return idbRequest<T>(tx.objectStore(STORE_NAME).get(key));
}

function idbCommit(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
