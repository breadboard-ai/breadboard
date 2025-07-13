/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, type Outcome } from "@google-labs/breadboard";
import type {
  GoogleDriveClient,
  NarrowedDriveFile,
} from "../google-drive-client.js";
import type { DriveChange, GraphInfo } from "./operations.js";
import { getSetsIntersection, getSetsUnion, readProperties } from "./utils.js";

export type CachedGoogleDriveFile = NarrowedDriveFile<
  ["id" | "name" | "modifiedTime" | "properties" | "appProperties"]
>;

/** Caches list of GraphInfo objects. */
export class DriveListCache {
  #forceRefreshOnce: boolean;
  readonly #googleDriveClient: GoogleDriveClient;

  constructor(
    private readonly cacheKey: string,
    private readonly query: string,
    googleDriveClient: GoogleDriveClient
  ) {
    // This is a hack to work around the problem where we don't track removals
    // of items from gallery.
    this.#forceRefreshOnce = !!new URLSearchParams(window.location.search).get(
      "force-refresh"
    );
    this.#googleDriveClient = googleDriveClient;
  }

  async #getCacheAndValue(skipValue: boolean = false) {
    const cacheKey = new URL(`http://drive-list/${this.cacheKey}`);
    const cache = await caches.open("DriveListCache");
    const cachedResponse = skipValue ? undefined : await cache.match(cacheKey);

    return { cache, cacheKey, cachedResponse };
  }

  async #put(options: {
    cache: Cache;
    cacheKey: URL;
    value: CachedGoogleDriveFile[];
    lastModified: string;
    /** if set override only the value that's not newer. */
    crossCheckLastModified?: string | null;
  }) {
    if (options.crossCheckLastModified) {
      const response = await options.cache.match(this.cacheKey);
      const currentLastModified = response?.headers?.get("Last-Modified");
      if (
        currentLastModified &&
        currentLastModified > options.crossCheckLastModified
      ) {
        // A newer value has been put in place in meanwhile, ignore this update.
        return false;
      }
    }
    options.cache.put(
      options.cacheKey,
      new Response(
        JSON.stringify({
          files: options.value,
        }),
        {
          headers: {
            "Last-Modified": options.lastModified,
          },
        }
      )
    );
    return true;
  }

  async #list(forceInvalidate: boolean = false) {
    if (this.#forceRefreshOnce) {
      forceInvalidate = true;
      this.#forceRefreshOnce = false;
    }
    try {
      // Find out if we have a cached value and if so, add the search criteria.

      const { cache, cacheKey, cachedResponse } =
        await this.#getCacheAndValue(forceInvalidate);
      if (forceInvalidate) {
        // Conservatively delete the cached value.
        cache.delete(cacheKey);
      }
      const cachedLastModified = cachedResponse?.headers?.get("Last-Modified");

      let query = this.query;
      if (cachedLastModified) {
        query = `${query} and modifiedTime > ${JSON.stringify(cachedLastModified)}`;
      }

      const response = await this.#googleDriveClient.listFiles(query, {
        fields: ["id", "name", "modifiedTime", "properties", "appProperties"],
        orderBy: {
          fields: ["modifiedTime"],
          dir: "desc",
        },
      });

      const updatedIds = new Set<string>(response.files.map((f) => f.id));
      const cachedList: CachedGoogleDriveFile[] =
        (await cachedResponse?.json())?.files ?? [];
      if (cachedList.length > 0) {
        // Removing all the cached files that have been since updated.
        const relevantList = cachedList.filter((f) => !updatedIds.has(f.id));
        response.files.push(...relevantList);
      }

      const { result, lastModified } = toGraphInfos(response.files);
      await this.#put({
        cache,
        cacheKey,
        value: response.files,
        lastModified: lastModified ?? "",
      });
      return result;
    } catch (e) {
      console.warn(e);
      return err((e as Error).message);
    }
  }

  async list(): Promise<Outcome<GraphInfo[]>> {
    return await this.#list();
  }

  async refresh(forceInvalidate = false) {
    await this.#list(forceInvalidate);
  }

  /**
   * Hard reloads the cache.
   * Never raises any errors. Doesn't buble up any events.
   */
  async forceRefresh() {
    try {
      await this.#list(/*forceInvalidate=*/ true);
    } catch (e) {
      console.warn(`Exception while refreshing ${this.cacheKey} background`, e);
      // And swallow it.
    }
  }

  /** Returns drive file IDs that were purged. */
  async processChanges(changes: Array<DriveChange>): Promise<Array<string>> {
    // Here we bulk-process all the changes in one go.
    const { cache, cacheKey, cachedResponse } = await this.#getCacheAndValue();
    if (cachedResponse) {
      const files: CachedGoogleDriveFile[] = (await cachedResponse?.json())
        ?.files;
      const fileIds = new Set(files.map((f) => f.id));
      // Collecting all unique changes, note that they don't have to point to the files in cache.
      const allDeletedIds = new Set<string>(
        changes.filter((c) => c.removed).map((c) => c.fileId)
      );
      const allUpdatedIds = new Set<string>(
        changes.filter((c) => !c.removed).map((c) => c.fileId)
      );
      const deletedIds = getSetsIntersection(fileIds, allDeletedIds);
      // TODO(volodya): This may work smarter by also comparing the timestamp of change/cached item.
      const updatedIds = getSetsIntersection(fileIds, allUpdatedIds);
      if (deletedIds.size > 0) {
        for (const id of deletedIds) {
          const index = files?.findIndex((f) => f.id == id);
          if (index >= 0) {
            files.splice(index, 1);
          }
        }
        // lastModified remains the same since this invalidation only concerns a single deleted file.
        const lastModified =
          cachedResponse?.headers?.get("Last-Modified") ?? "";
        await this.#put({ cache, cacheKey, value: files, lastModified });
      }
      if (updatedIds.size > 0) {
        // We don't know what has actually changes so we just re-read the whole list.
        // But first, conservatively delete first so that any concurrent read reads fresh data.
        await cache.delete(cacheKey);
        await this.forceRefresh(); // This could be smarter what it re-reads, but probably not much faster.
      }
      return Array.from(getSetsUnion(updatedIds, deletedIds));
    }
    return [];
  }

  /** Returns true if the cache was in fact affected, and false in case of a no-op. */
  async invalidateDeleted(id: string): Promise<boolean> {
    const { cache, cacheKey, cachedResponse } = await this.#getCacheAndValue();
    if (cachedResponse) {
      const files: CachedGoogleDriveFile[] = (await cachedResponse?.json())
        ?.files;
      const index = files?.findIndex((f) => f.id == id);
      if (index >= 0) {
        files.splice(index, 1);
        // lastModified remains the same since this invalidation only concerns a single deleted file.
        const lastModified =
          cachedResponse?.headers?.get("Last-Modified") ?? "";
        await this.#put({ cache, cacheKey, value: files, lastModified });
        return true;
      }
    }
    return false;
  }
}

function toGraphInfos(files: CachedGoogleDriveFile[]): {
  result: Array<GraphInfo>;
  lastModified?: string;
} {
  let lastModified: string | undefined;
  const result = files.map((file) => {
    if (file.modifiedTime && file.modifiedTime > (lastModified ?? "")) {
      lastModified = file.modifiedTime;
    }
    const appProperties = readProperties(file);
    return {
      id: file.id,
      title: appProperties.title || file.name.replace(/(\.bgl)?\.json$/, ""),
      tags: appProperties.tags,
      thumbnail: appProperties.thumbnailUrl,
      description: appProperties.description,
    } satisfies GraphInfo;
  });
  return { result, lastModified };
}
