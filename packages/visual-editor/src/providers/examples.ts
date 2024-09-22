/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BreadboardManifest, isReference } from "@breadboard-ai/manifest";
import {
  GraphDescriptor,
  GraphProvider,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphProviderItem,
} from "@google-labs/breadboard";
import { GraphProviderStore } from "./types.js";

export class ExamplesGraphProvider implements GraphProvider {
  name = "ExamplesGraphProvider";

  #blank: URL | null = null;
  #items: Map<string, GraphProviderStore> = new Map();

  #ready = Promise.resolve();
  ready() {
    return this.#ready;
  }

  constructor(manifests: Map<string, BreadboardManifest>) {
    for (const [title, manifest] of manifests) {
      this.#setItemsFromManifest(title, manifest);
    }
  }

  #setItemsFromManifest(title: string, manifest: BreadboardManifest) {
    const boards = manifest.boards || [];
    const blank = boards
      .filter(isReference)
      .find((board) => board.reference?.endsWith("blank.bgl.json"));

    if (blank?.reference) {
      this.#blank = new URL(blank.reference, window.location.href);
    }
    const boardMap: Map<string, GraphProviderItem> = new Map(
      boards
        .map((board) => ({
          ...board,
          title: board.title || (isReference(board) && board.reference) || "",
        }))
        .sort((a, b) => a.title!.localeCompare(b.title!))
        .map((board) => {
          if (!isReference(board)) {
            throw new Error("Expected board to be a reference.");
          }
          const url = new URL(board.reference!, window.location.href);
          return [
            board.title,
            {
              url: url.href,
              readonly: true,
              mine: false,
              handle: undefined,
              tags: board.tags,
            },
          ];
        })
    );
    this.#items.set(title, {
      permission: "granted",
      title,
      items: boardMap,
    });
  }

  items(): Map<string, GraphProviderStore> {
    return this.#items;
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(_url: URL): false | GraphProviderCapabilities {
    // Never use this provider for loading.
    return false;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: false,
      connect: false,
      disconnect: false,
      refresh: false,
      watch: false,
      preview: false,
    };
  }

  async load(_url: URL): Promise<GraphDescriptor | null> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to load graphs."
    );
  }

  async save(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to save graphs."
    );
  }

  async createBlank(
    _url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to create blank graphs."
    );
  }

  async create(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to create graphs."
    );
  }

  async delete(
    _url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to delete graphs."
    );
  }

  async connect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to connect."
    );
  }

  async disconnect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to disconnect."
    );
  }

  async refresh(_location: string): Promise<boolean> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to refresh."
    );
  }

  async createURL(_location: string, _fileName: string): Promise<string> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to create URL."
    );
  }

  async preview(_url: URL): Promise<URL> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to preview"
    );
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to parse URL."
    );
  }

  async restore(): Promise<void> {}

  startingURL(): URL | null {
    return this.#blank;
  }

  watch(): void {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to watch."
    );
  }
}
