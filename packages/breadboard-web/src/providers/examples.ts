/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphProvider,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
} from "@google-labs/breadboard";
import { BreadboardManifest } from "@google-labs/breadboard-manifest";
import { GraphProviderStore } from "./types";

export class ExamplesGraphProvider implements GraphProvider {
  name = "ExamplesGraphProvider";

  #blank: URL | null = null;
  #items: Map<string, GraphProviderStore> = new Map();

  constructor(manifest: BreadboardManifest) {
    const boards = manifest.boards || [];
    const blank = boards.find((board) => {
      return board.reference?.endsWith("blank.json");
    });
    if (blank?.reference) {
      this.#blank = new URL(blank.reference, window.location.href);
    }
    const boardMap: Map<
      string,
      {
        url: string;
        readonly: boolean;
        mine: boolean;
        handle: undefined;
      }
    > = new Map(
      boards
        .map((board) => ({
          ...board,
          title: board.title || board.reference || "",
        }))
        .sort((a, b) => a.title!.localeCompare(b.title!))
        .map((board) => [
          board.title,
          {
            url: board.reference!,
            readonly: true,
            mine: false,
            handle: undefined,
          },
        ])
    );
    this.#items.set("examples", {
      permission: "granted",
      title: "Example Boards",
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
