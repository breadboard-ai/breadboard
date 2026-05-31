/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";
import { UserNote } from "./types.js";
import { GroupedByType, ParsedFileMedata } from "./parse-file-name.js";
import { FileSystemEvalBackend, FileSystemEvalBackendHandle } from "./filesystem.js";
import { ok } from "@breadboard-ai/utils";

export { EvalStateStore };

class EvalStateStore {
  readonly notes = new Signal.State<UserNote[]>([]);
  readonly filesInMountedDir = new Signal.State<GroupedByType[]>([]);
  readonly flatFiles = new Signal.State<ParsedFileMedata[]>([]);
  readonly hasSidecars = new Signal.Computed(() => {
    return this.flatFiles.get().some((f) => !!f.hasSidecars);
  });

  readonly selectedFilePath = new Signal.State<string | null>(null);
  readonly selectedPath = new Signal.State<FileSystemEvalBackendHandle | null>(null);

  #observer: { disconnect(): void } | null = null;
  #fileSystem: FileSystemEvalBackend;

  constructor(fileSystem: FileSystemEvalBackend) {
    this.#fileSystem = fileSystem;
  }

  async selectDirectory(pathHandle: FileSystemEvalBackendHandle | null) {
    this.selectedPath.set(pathHandle);
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }

    if (pathHandle && pathHandle.handle) {
      await this.scanMountedDirectory(pathHandle.path);
      this.#startObserver(pathHandle.handle);
    } else {
      this.filesInMountedDir.set([]);
      this.flatFiles.set([]);
    }
  }

  async selectFile(filePath: string | null) {
    this.selectedFilePath.set(filePath);
    if (filePath) {
      await this.readNotesForCurrentFile(filePath);
    } else {
      this.notes.set([]);
    }
  }

  async readNotesForCurrentFile(filePath: string) {
    const result = await this.#fileSystem.readNotes(filePath);
    if (ok(result)) {
      this.notes.set(result.notes || []);
    } else {
      this.notes.set([]);
    }
  }

  async scanMountedDirectory(dirPath: string) {
    const files = await this.#fileSystem.query(dirPath);
    if (ok(files)) {
      this.filesInMountedDir.set(files);
      const flatFiles: ParsedFileMedata[] = [];
      for (const group of files) {
        for (const item of group.items) {
          flatFiles.push(...item.files);
        }
      }
      this.flatFiles.set(flatFiles);
    } else {
      this.filesInMountedDir.set([]);
      this.flatFiles.set([]);
    }
  }

  async addNote(filePath: string, updatedNotes: UserNote[]) {
    const result = await this.#fileSystem.writeNotes(filePath, { notes: updatedNotes });
    if (ok(result)) {
      // Opt out of updating this.notes manually; we let FileSystemObserver catch the write
      // and trigger the signal update automatically, but for robust feedback we can update now.
      this.notes.set(updatedNotes);
      // Re-trigger scan in the background to update sidebar count
      if (this.selectedPath.get()) {
        void this.scanMountedDirectory(this.selectedPath.get()!.path);
      }
    }
    return result;
  }

  async deleteNote(filePath: string, updatedNotes: UserNote[]) {
    const result = await this.#fileSystem.writeNotes(filePath, { notes: updatedNotes });
    if (ok(result)) {
      this.notes.set(updatedNotes);
      if (this.selectedPath.get()) {
        void this.scanMountedDirectory(this.selectedPath.get()!.path);
      }
    }
    return result;
  }

  #startObserver(dirHandle: FileSystemDirectoryHandle): void {
    if (!("FileSystemObserver" in globalThis)) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (globalThis as any).FileSystemObserver;
      const observer = new Ctor(async (records: unknown[]) => {
        let notesChanged = false;

        for (const record of records) {
          const r = record as { relativePathComponents?: string[] };
          const parts = r.relativePathComponents;
          if (!parts || parts.length === 0) continue;

          const filename = parts[parts.length - 1];
          if (filename.endsWith(".notes.json")) {
            notesChanged = true;
          }
        }

        if (notesChanged) {
          const currentFile = this.selectedFilePath.get();
          if (currentFile) {
            await this.readNotesForCurrentFile(currentFile);
          }
          const currentPath = this.selectedPath.get();
          if (currentPath) {
            await this.scanMountedDirectory(currentPath.path);
          }
        }
      });

      observer.observe(dirHandle, { recursive: false });
      this.#observer = observer;
    } catch (e) {
      console.warn("EvalStateStore: Failed to start FileSystemObserver:", e);
    }
  }

  destroy() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }
}
