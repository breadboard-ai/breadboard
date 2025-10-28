/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphProviderItem,
  ImmutableGraphCollection,
} from "@breadboard-ai/types";
import type { SignInInfo } from "@breadboard-ai/types/sign-in-info.js";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import type { NarrowedDriveFile } from "../google-drive-client.js";
import { readProperties } from "./utils.js";

export class DriveGalleryGraphCollection implements ImmutableGraphCollection {
  readonly #signInInfo: SignInInfo;
  readonly #fetchWithCreds: typeof globalThis.fetch;
  readonly #graphs = new SignalMap<string, GraphProviderItem>();
  readonly #backendApiUrl: string;

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

  constructor(
    signInInfo: SignInInfo,
    fetchWithCreds: typeof globalThis.fetch,
    backendApiUrl: string
  ) {
    this.#signInInfo = signInInfo;
    this.#fetchWithCreds = fetchWithCreds;
    this.#backendApiUrl = backendApiUrl;
    void this.#initialize();
  }

  async #initialize() {
    const url = new URL("/api/gallery/list", window.location.href);
    const location = await this.#getUserLocation();
    if (location) {
      url.searchParams.set("location", location);
    }
    let response;
    try {
      response = await fetch(url);
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

  async #getUserLocation(): Promise<string | undefined> {
    const endpoint = this.#backendApiUrl;
    if (!endpoint) {
      return undefined;
    }
    if (this.#signInInfo.state === "signedout") {
      return undefined;
    }

    const locationResponse = await this.#fetchWithCreds(
      new URL(`/v1beta1/getLocation`, endpoint)
    );
    if (!locationResponse.ok) {
      console.error(
        `HTTP ${locationResponse.status} error getting user location`
      );
      return undefined;
    }
    const locationResult = (await locationResponse.json()) as {
      countryCode: string;
    };
    return locationResult.countryCode;
  }

  #setError(e: Error) {
    console.error(`[gallery] ${e.message}`, e);
    this.#error = e;
  }
}
