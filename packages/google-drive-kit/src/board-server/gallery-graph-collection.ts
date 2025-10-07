/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type {
  GraphProviderItem,
  ImmutableGraphCollection,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import type { NarrowedDriveFile } from "../google-drive-client.js";
import { readProperties } from "./utils.js";

export class DriveGalleryGraphCollection implements ImmutableGraphCollection {
  readonly #tokenVendor: TokenVendor;
  readonly #graphs = new SignalMap<string, GraphProviderItem>();

  has(url: string): boolean {
    return this.#graphs.has(url);
  }

  entries(): IterableIterator<[string, GraphProviderItem]> {
    return this.#graphs.entries();
  }

  get size(): number {
    return this.#graphs.size;
  }

  @signal accessor #loading = true;
  get loading(): boolean {
    return this.#loading;
  }

  #loaded = Promise.withResolvers<void>();
  get loaded() {
    return this.#loaded.promise;
  }

  @signal accessor #error: Error | undefined = undefined;
  get error(): Error | undefined {
    return this.#error;
  }

  constructor(tokenVendor: TokenVendor) {
    this.#tokenVendor = tokenVendor;
    void this.#initialize();
  }

  async #initialize() {
    const url = new URL("/api/gallery/list", window.location.href);
    let response;
    try {
      let tokenResult = this.#tokenVendor.getToken("$sign-in");
      if (tokenResult.state === "expired") {
        tokenResult = await tokenResult.refresh();
      }
      const token =
        tokenResult.state === "valid"
          ? tokenResult.grant.access_token
          : undefined;
      response = await fetch(
        url,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
    } catch (e) {
      this.#setError(
        new AggregateError([e], `network error while listing gallery graphs`)
      );
      return;
    }
    if (!response.ok) {
      this.#setError(
        new Error(`HTTP ${response.status} error while listing gallery graphs`)
      );
      return;
    }
    let files: Array<NarrowedDriveFile<"id" | "name" | "properties">>;
    try {
      files = await response.json();
    } catch (e) {
      this.#setError(
        new AggregateError([e], `JSON parse error while listing gallery graphs`)
      );
      return;
    }
    for (const file of files) {
      const url = `drive:/${file.id}`;
      const properties = readProperties(file);
      this.#graphs.set(url, {
        url,
        title: file.name,
        description: properties.description,
        thumbnail: properties.thumbnailUrl,
        mine: false,
        readonly: true,
        handle: null,
      });
    }
    this.#loading = false;
    this.#loaded.resolve();
  }

  #setError(e: Error) {
    console.error(`[gallery] ${e.message}`, e);
    this.#error = e;
  }
}
