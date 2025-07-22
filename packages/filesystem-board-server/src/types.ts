/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type FileSystemWalkerEntry =
  | FileSystemDirectoryHandle
  | FileSystemFileHandle;

declare global {
  interface FileSystemWalker {
    [Symbol.asyncIterator](): AsyncIterator<[string, FileSystemWalkerEntry]>;
  }

  interface FileSystemFileHandle {
    readonly kind: "file";
    name: string;
    isSameEntry(other: FileSystemFileHandle): Promise<boolean>;
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
    remove(): Promise<void>;
  }

  // Augmented interface to the default one in TypeScript. This one accounts for
  // the API added by Chrome.
  export interface FileSystemDirectoryHandle {
    readonly kind: "directory";
    name: string;
    entries(): FileSystemWalker;
    queryPermission(options?: {
      mode: "read" | "write" | "readwrite";
    }): Promise<"prompt" | "granted">;
    requestPermission(options?: {
      mode: "read" | "write" | "readwrite";
    }): Promise<"prompt" | "granted">;
    removeEntry(name: string, options?: { recursive: boolean }): Promise<void>;
    getFileHandle(
      name: string,
      options?: { create: boolean }
    ): Promise<FileSystemFileHandle>;
    getDirectoryHandle(
      name: string,
      options?: { create: boolean }
    ): Promise<FileSystemDirectoryHandle>;
  }

  interface Window {
    showDirectoryPicker(options?: {
      mode: string;
    }): Promise<FileSystemDirectoryHandle>;

    showSaveFilePicker(options?: {
      excludeAcceptAllOptions?: boolean;
      id?: string;
      startIn?: FileSystemHandle | string;
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }): Promise<FileSystemFileHandle>;
  }
}
