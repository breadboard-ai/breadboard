/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type { Asset, GraphTag, OutputValues } from "@breadboard-ai/types";
import {
  err,
  ok,
  type GraphDescriptor,
  type Outcome,
} from "@google-labs/breadboard";
import { getAccessToken } from "./access.js";
import {
  Files,
  type AppProperties,
  type DriveFile,
  type DriveFileQuery,
  type GoogleApiAuthorization,
  type Properties,
} from "./api.js";

export { DriveOperations, PROTOCOL };

import {
  extractGoogleDriveFileId,
  getSetsIntersection,
  retryableFetch,
  truncateValueForUtf8,
} from "./utils.js";

const PROTOCOL = "drive:";

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const DEPRECATED_GRAPH_MIME_TYPE = "application/json";
const RUN_RESULTS_MIME_TYPE = "application/vnd.breadboard.run-results+json";

const MIME_TYPE_QUERY = `(mimeType="${GRAPH_MIME_TYPE}" or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")`;
const BASE_QUERY = `${MIME_TYPE_QUERY} and trashed=false`;

const CHANGE_LIST_START_PAGE_TOKEN_STORAGE_KEY =
  "GoogleDriveService/Changes/StartPageToken";

// These must be in sync with image.ts:*
const DRIVE_IMAGE_CACHE_NAME = "GoogleDriveImages";
const DRIVE_IMAGE_CACHE_KEY_PREFIX = "http://drive-image/";

const DRIVE_FETCH_CHANGES_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes.

const MAX_APP_PROPERTY_LENGTH = 124;

export type GraphInfo = {
  id: string;
  title: string;
  tags: GraphTag[];
  thumbnail: string | undefined;
  description: string;
};

/** Defines api.ts:AppProperties as stored in the drive file */
type StoredAppProperties = {
  title: string;
  description: string;
  tags: string;
  thumbnailUrl?: string;
};

type DriveChange = {
  fileId: string;
  removed?: boolean;
};

type DriveChangesCacheState = {
  startPageToken: string;
  /** Date. */
  lastFetched: string;
};

/** Responsible for cleaning lookup caches based on list of changes from drive. */
class DriveLookupCache {
  constructor(
    private readonly cacheName: string,
    private readonly cacheKePrefix: string
  ) {}

  async invalidateId(fileID: string) {
    const cache = await caches.open(this.cacheName);
    const cacheKey = new URL(`${this.cacheKePrefix}${fileID}`);
    await cache.delete(cacheKey);
  }

  async processChanges(changes: Array<DriveChange>) {
    const ids = changes.map((change) => change.fileId);
    const cache = await caches.open(this.cacheName);
    // Bulk remove in parallel.
    await Promise.all(
      ids.map((id) => {
        const cacheKey = new URL(`${this.cacheKePrefix}${id}`);
        return cache.delete(cacheKey);
      })
    );
  }
}

/** Caches list of GraphInfo objects. */
class DriveListCache {
  constructor(
    private readonly cacheKey: string,
    private readonly query: string,
    private readonly auth: () => Promise<Readonly<GoogleApiAuthorization>>
  ) {}

  async #getCacheAndValue(skipValue: boolean = false) {
    const cacheKey = new URL(`http://drive-list/${this.cacheKey}`);
    const cache = await caches.open("DriveListCache");
    const cachedResponse = skipValue ? undefined : await cache.match(cacheKey);

    return { cache, cacheKey, cachedResponse };
  }

  async #put(options: {
    cache: Cache;
    cacheKey: URL;
    value: DriveFile[];
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
    try {
      // Find out if we have a cached value and if so, add the search criteria.

      const { cache, cacheKey, cachedResponse } =
        await this.#getCacheAndValue(forceInvalidate);
      if (forceInvalidate) {
        // Conservatively delete the chacked value.
        cache.delete(cacheKey);
      }
      const cachedLastModified = cachedResponse?.headers?.get("Last-Modified");

      let query = this.query;
      if (cachedLastModified) {
        query = `${query} and modifiedTime > ${JSON.stringify(cachedLastModified)}`;
      }

      const api = new Files(await this.auth());
      const fileRequest = await retryableFetch(api.makeQueryRequest(query));
      const response: DriveFileQuery = await fileRequest.json();

      // TODO: This is likely due to an auth error.
      if (!("files" in response)) {
        console.warn(response);
        return err(`Unable to get Drive folder contents. Likely an auth error`);
      }

      const updatedIds = new Set<string>(response.files.map((f) => f.id));
      const cachedList: DriveFile[] =
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

  async refresh() {
    await this.#list();
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

  async processChanges(changes: Array<DriveChange>) {
    // Here we bulk-process all the changes in one go.
    const { cache, cacheKey, cachedResponse } = await this.#getCacheAndValue();
    if (cachedResponse) {
      const files: DriveFile[] = (await cachedResponse?.json())?.files;
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
        // But first, conservatively delete first so that any concurent read reads fresh data.
        await cache.delete(cacheKey);
        await this.forceRefresh(); // This could be smarter what it re-reads, but probably not much faster.
      }
      return updatedIds.size > 0 || updatedIds.size > 0;
    }
    return false;
  }

  /** Returns true if the cache was in fact affected, and false in case of a no-op. */
  async invalidateDeleted(id: string): Promise<boolean> {
    const { cache, cacheKey, cachedResponse } = await this.#getCacheAndValue();
    if (cachedResponse) {
      const files: DriveFile[] = (await cachedResponse?.json())?.files;
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

class DriveOperations {
  readonly #userFolderName: string;
  readonly #publicApiKey?: string;
  readonly #featuredGalleryFolderId?: string;
  readonly #userGraphsList: DriveListCache;
  readonly #featuredGraphsList?: DriveListCache;
  readonly #imageCache = new DriveLookupCache(
    DRIVE_IMAGE_CACHE_NAME,
    DRIVE_IMAGE_CACHE_KEY_PREFIX
  );

  /**
   * @param refreshProjectListCallback will be called when project list may have to be updated.
   */
  constructor(
    public readonly vendor: TokenVendor,
    public readonly username: string,
    private readonly refreshProjectListCallback: () => Promise<void>,
    userFolderName: string,
    publicApiKey?: string,
    featuredGalleryFolderId?: string
  ) {
    if (!userFolderName) {
      throw new Error(`userFolderName was empty`);
    }
    this.#userFolderName = userFolderName;
    this.#publicApiKey = publicApiKey;
    this.#featuredGalleryFolderId = featuredGalleryFolderId;

    const getUserAuth = () => DriveOperations.getUserAuth(vendor);
    this.#userGraphsList = new DriveListCache("user", BASE_QUERY, getUserAuth);

    if (featuredGalleryFolderId && this.#publicApiKey) {
      const getApiAuth = () =>
        Promise.resolve({
          kind: "key",
          key: this.#publicApiKey!,
        } satisfies GoogleApiAuthorization);
      this.#featuredGraphsList = new DriveListCache(
        "featured",
        `"${featuredGalleryFolderId}" in parents and ${BASE_QUERY}`,
        getApiAuth
      );
    }

    this.#setupBackgroundRefresh();
  }

  async #setupBackgroundRefresh() {
    setTimeout(
      async () => {
        try {
          {
            const driveCacheState = getDriveCacheState();
            if (!driveCacheState) {
              // No changes token yet - we capture one and invalidate all the caches.
              const api = new Files(
                await DriveOperations.getUserAuth(this.vendor)
              );
              const response = await retryableFetch(
                api.makeGetStartPageTokenRequest()
              );
              if (!response.ok) {
                console.error("Failed to get start page token", response);
                // Will be retried next time.
                throw new Error(
                  `Failed to get start page token: ${response.status} ${response.statusText}`
                );
              }
              const pageToken = (await response.json()).startPageToken;
              if (!pageToken) {
                // Will be retried next time.
                console.error(
                  "Response containing not startPageToken",
                  response
                );
                throw new Error(`Response containing not startPageToken`);
              }
              if (stillHoldsState(driveCacheState)) {
                setDriveCacheState({ startPageToken: pageToken });
                // Our token is allocated for the next time, now we purge the caches.
                await this.#userGraphsList.forceRefresh();
                if (this.#featuredGalleryFolderId) {
                  await this.#featuredGraphsList!.forceRefresh();
                }
                // #imageCache relies solely on the drive.changes, no invalidation here needed.
              }
              return; // All refreshed.
            }
          }

          // If a start page token set - we continue reading from that point otherwise all changes.
          const driveCacheState = getDriveCacheState();
          if (!driveCacheState) {
            // Normally this should not happen, but the user might have removed the localStorage's key.
            return; // In finally we should initialize the token again.
          }
          if (
            Date.now() - Date.parse(driveCacheState.lastFetched) <
            DRIVE_FETCH_CHANGES_INTERVAL_MS
          ) {
            return; // Too early, or might have been updated concurrently.
          }
          const [changes, newStartPageToken] = await this.#fetchAllChanges(
            driveCacheState.startPageToken
          );

          if (changes?.length > 0) {
            // Run processChanges() in parallel.
            const promises = [
              this.#userGraphsList.processChanges(changes),
              this.#imageCache.processChanges(changes),
            ];
            if (this.#featuredGalleryFolderId) {
              promises.push(this.#featuredGraphsList!.processChanges(changes));
            }
            await Promise.all(promises);
          }
          if (newStartPageToken) {
            // At last we update the new start page token so that the next time we continue from here.
            if (stillHoldsState(driveCacheState)) {
              setDriveCacheState({ startPageToken: newStartPageToken });
            }
          }
        } finally {
          await this.#setupBackgroundRefresh();
        }
      },
      Math.random() * DRIVE_FETCH_CHANGES_INTERVAL_MS + 1000
    );
  }

  async #fetchAllChanges(
    pageToken: string
  ): Promise<[Array<DriveChange>, string | undefined]> {
    const api = new Files(await DriveOperations.getUserAuth(this.vendor));
    const changes: Array<DriveChange> = [];
    let newStartPageToken: string | undefined;
    do {
      const response = await retryableFetch(
        api.makeChangeListRequest(pageToken)
      );
      if (!response.ok) {
        console.error("Response not OK", response);
        // This may be due to an invalid token, so let's just trash it and retry.
        setDriveCacheState(null);
        throw new Error("Failed to fetch drive changes");
      }
      const data = await response.json();
      pageToken = data.nextPageToken;
      if (data.changes) {
        changes.push(...data.changes);
      }
      if (data.newStartPageToken) {
        // Should be always present, but just in case it's safer not to override the last successful value.
        newStartPageToken = data.newStartPageToken;
      }
    } while (pageToken);
    return [changes, newStartPageToken];
  }

  static getUserAuth(vendor: TokenVendor): Promise<GoogleApiAuthorization> {
    return getAccessToken(vendor).then((token) => {
      if (!token) {
        throw new Error("No access token");
      }
      return {
        kind: "bearer",
        token: token!,
      };
    });
  }

  static async readFolder(folderId: string, vendor: TokenVendor) {
    const accessToken = await getAccessToken(vendor);

    try {
      const api = new Files({ kind: "bearer", token: accessToken! });
      const response = await retryableFetch(api.makeGetRequest(folderId));

      const folder: DriveFile = await response.json();
      if (!folder) {
        return null;
      }

      return folder;
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  async readGraphList(): Promise<Outcome<GraphInfo[]>> {
    return await this.#userGraphsList.list();
  }

  async readFeaturedGalleryGraphList(): Promise<Outcome<GraphInfo[]>> {
    if (!this.#featuredGalleryFolderId) {
      return err(
        "Could not read featured gallery from Google Drive:" +
          " No folder id configured."
      );
    }
    if (!this.#publicApiKey) {
      return err(
        "Could not read featured gallery from Google Drive:" +
          " No public API key configured."
      );
    }
    console.assert(
      this.#featuredGraphsList,
      "featuredGalleryFolderId or publicApiKey is missing"
    );
    const graphInfos = await this.#featuredGraphsList!.list();
    if (!ok(graphInfos)) {
      return graphInfos;
    }
    const results = graphInfos.map((graphInfo) => {
      if (!graphInfo.tags.includes("featured")) {
        // The fact that a graph is in the featured folder alone determines
        // whether it is featured.
        graphInfo.tags.push("featured");
      }
      return graphInfo;
    });
    return results;
  }

  async readSharedGraphList(): Promise<string[]> {
    // NOTE: Since this is used only within debug panel, we don't employ the DriveListCache.
    const accessToken = await getAccessToken(this.vendor);
    if (!accessToken) {
      throw new Error("No folder ID or access token");
    }
    const query =
      ` (mimeType="${GRAPH_MIME_TYPE}"` +
      `  or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")` +
      ` and sharedWithMe=true` +
      ` and trashed=false`;
    const api = new Files({ kind: "bearer", token: accessToken });
    const fileRequest = await retryableFetch(api.makeQueryRequest(query));
    const response: DriveFileQuery = await fileRequest.json();
    return response.files.map((file) => file.id);
  }

  async getThumbnailFileId(
    api: Files,
    boardFileId: string
  ): Promise<string | undefined> {
    // There is probably a better way to do this - we need appProperties of the drive file.
    // Those were read during load/listing of the board, however they don't have a place in the
    // data model hence didn't make it to here.
    // Since such requests are cheap and fast it's fine for now.
    // TODO(volodya): Pass the app properties and remove the need for this.
    const response = await retryableFetch(api.makeGetRequest(boardFileId));
    const appProperties = readAppProperties(await response.json());
    const url = appProperties.thumbnailUrl;
    return url ? getFileId(url) : undefined;
  }

  async writeGraphToDrive(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    const file = this.fileIdFromUrl(url);
    const name = getFileTitle(descriptor);
    const accessToken = await getAccessToken(this.vendor);
    try {
      const api = new Files({ kind: "bearer", token: accessToken! });

      const thumbnailUrl = await this.upsertThumbnailFile(
        file,
        api,
        name,
        descriptor
      );

      await retryableFetch(
        api.makePatchRequest(file, [
          {
            contentType: "application/json; charset=UTF-8",
            data: {
              name,
              appProperties: createAppProperties(
                file,
                descriptor,
                thumbnailUrl
              ),
              mimeType: GRAPH_MIME_TYPE,
            },
          },
          {
            contentType: "application/json; charset=UTF-8",
            data: descriptor,
          },
        ])
      );

      return { result: true };
    } catch (err) {
      console.warn(err);
      return { result: false, error: "Unable to save" };
    } finally {
      // The above update is a non-atomic operation so refresh after both success or fail.
      await this.#refreshUserList();
    }
  }

  async writeNewGraphToDrive(
    url: URL,
    parent: string,
    descriptor: GraphDescriptor
  ) {
    const fileName = this.fileIdFromUrl(url);
    const name = getFileTitle(descriptor);
    const accessToken = await getAccessToken(this.vendor);

    try {
      const api = new Files({ kind: "bearer", token: accessToken! });
      const thumbnailUrl = await this.upsertThumbnailFile(
        fileName,
        api,
        name,
        descriptor
      );

      const response = await retryableFetch(
        api.makeMultipartCreateRequest([
          {
            contentType: "application/json; charset=UTF-8",
            data: {
              name,
              mimeType: GRAPH_MIME_TYPE,
              parents: [parent],
              appProperties: createAppProperties(
                fileName,
                descriptor,
                thumbnailUrl
              ),
            },
          },
          {
            contentType: "application/json; charset=UTF-8",
            data: descriptor,
          },
        ])
      );

      const file: DriveFile = await response.json();
      const updatedUrl = `${PROTOCOL}/${file.id}`;

      console.log("Google Drive: Created new board", updatedUrl);
      return { result: true, url: updatedUrl };
    } catch (err) {
      console.warn(err);
      return { result: false, error: "Unable to create" };
    } finally {
      // The above update is a non-atomic operation so refresh after both success or fail.
      await this.#refreshUserList();
    }
  }

  async writeRunResults(results: {
    graphUrl: string;
    finalOutputValues: OutputValues;
  }): Promise<void> {
    const accessToken = await getAccessToken(this.vendor);
    if (!accessToken) {
      throw new Error(`No access token`);
    }
    // TODO(aomarks) It would be nice if this saved within a Results folder.
    // Probably part of a larger organization scheme we should have for the
    // Drive folder.
    const parentFolderId = await this.findOrCreateFolder();
    if (typeof parentFolderId !== "string" || !parentFolderId) {
      throw new Error(`Unexpected parent folder result ${parentFolderId}`);
    }
    const api = new Files({ kind: "bearer", token: accessToken });
    const graphFileId = extractGoogleDriveFileId(results.graphUrl);
    const request = api.makeMultipartCreateRequest([
      {
        contentType: "application/json; charset=UTF-8",
        data: {
          name:
            [`results`, graphFileId, crypto.randomUUID()].join("-") + ".json",
          mimeType: RUN_RESULTS_MIME_TYPE,
          parents: [parentFolderId],
          // TODO(aomarks) Add an (app?) property that links to the graph file
          // id so that we can list all results for a particular graph for the
          // history view.
        },
      },
      {
        contentType: "application/json; charset=UTF-8",
        // TODO(aomarks) Handle external content, either by inling or copying
        // each non-Drive content to Drive. Remember to deal with HTML content,
        // too, which can contain its own external content references.
        data: results,
      },
    ]);
    await retryableFetch(request);
  }

  async saveDataPart(data: string, mimeType: string) {
    const accessToken = await getAccessToken(this.vendor);
    const api = new Files({ kind: "bearer", token: accessToken! });
    // Start in parallel.
    const parentPromise = this.findOrCreateFolder();
    // TODO: Update to retryable.
    const uploadResponse = await fetch(
      api.makeUploadRequest(undefined, data, mimeType)
    );
    const file: DriveFile = await uploadResponse.json();
    // TODO: Update to retryable.
    fetch(
      api.makeUpdateMetadataRequest(file.id, (await parentPromise) as string, {
        // None, just the parent.
      })
    ).catch((e) => {
      console.error("Failed to update image metadata", e);
    });
    return `${PROTOCOL}/${file.id}`;
  }

  async #refreshUserList() {
    // In that order, awating.
    await this.#userGraphsList.refresh();
    await this.refreshProjectListCallback();
  }

  /** Also patches the asset with the url if a file got created.  */
  private async upsertThumbnailFile(
    boardFileId: string,
    api: Files,
    graphFileName: string,
    descriptor?: GraphDescriptor
  ): Promise<string | undefined> {
    // First try the splash screen in the theme.

    const { data, contentType, asset } = getThumbnail(descriptor);
    if (!data) {
      return undefined;
    }

    if (isDriveFile(data)) {
      return data;
    }

    const thumbnailFileId = await this.getThumbnailFileId(api, boardFileId);

    if (!data) {
      if (thumbnailFileId) {
        this.#imageCache.invalidateId(thumbnailFileId);
        // The user has switched to the default theme - delete the file.
        retryableFetch(api.makeDeleteRequest(thumbnailFileId)) // No need to await.
          .catch((e) => {
            console.error(
              "Failed to delete thumbnail file",
              thumbnailFileId,
              e
            );
          });
      }
      return undefined;
    }

    // Start in parallel.
    const parentPromise = this.findOrCreateFolder();

    const responsePromise = retryableFetch(
      api.makeUploadRequest(
        thumbnailFileId,
        data,
        maybeStripBase64Suffix(contentType ?? "")
      )
    );
    // TODO(volodya): Optimize - when dealing with an existing file there is no need to await here.
    const response = await responsePromise;

    const file: DriveFile = await response.json();
    const thumbnailUrl = `${PROTOCOL}/${file.id}`;

    const name = `${graphFileName} Thumbnail`;
    // Don't wait for the response since we don't depend on it
    retryableFetch(
      api.makeUpdateMetadataRequest(file.id, (await parentPromise) as string, {
        name,
      })
    ).catch((e) => {
      console.error("Failed to update image metadata", e);
    });
    this.#imageCache.invalidateId(file.id);

    if (asset) {
      asset.data = thumbnailUrl;
    }
    return thumbnailUrl;
  }

  async listAssets(): Promise<string[]> {
    const accessToken = await getAccessToken(this.vendor);
    if (!accessToken) {
      throw new Error("No folder ID or access token");
    }
    const query = `(mimeType contains 'image/')` + ` and trashed=false`;
    const api = new Files({ kind: "bearer", token: accessToken });
    const fileRequest = await retryableFetch(api.makeQueryRequest(query));
    const response: DriveFileQuery = await fileRequest.json();
    return response.files.map((file) => file.id);
  }

  #cachedFolderId?: string;

  async findFolder(): Promise<Outcome<string | undefined>> {
    if (this.#cachedFolderId) {
      return this.#cachedFolderId;
    }
    const accessToken = await getAccessToken(this.vendor);
    if (!accessToken) {
      return err("No access token");
    }
    const api = new Files({ kind: "bearer", token: accessToken });
    const findRequest = api.makeQueryRequest(
      `name=${quote(this.#userFolderName)}` +
        ` and mimeType="${GOOGLE_DRIVE_FOLDER_MIME_TYPE}"` +
        ` and trashed=false`
    );
    try {
      const { files } = (await (
        await retryableFetch(findRequest)
      ).json()) as DriveFileQuery;
      if (files.length > 0) {
        if (files.length > 1) {
          console.warn(
            "Google Drive: Multiple candidate root folders found," +
              " picking the first one arbitrarily:",
            files
          );
        }
        const id = files[0]!.id;
        console.log("Google Drive: Found existing root folder", id);
        this.#cachedFolderId = id;
        return id;
      }
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async findOrCreateFolder(): Promise<Outcome<string>> {
    const existing = await this.findFolder();
    if (typeof existing === "string" && existing) {
      return existing;
    }

    const accessToken = await getAccessToken(this.vendor);
    if (!accessToken) {
      return err("No access token");
    }
    const api = new Files({ kind: "bearer", token: accessToken });
    const createRequest = api.makeCreateRequest({
      name: this.#userFolderName,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    });
    try {
      const { id } = (await (await retryableFetch(createRequest)).json()) as {
        id: string;
      };
      console.log("Google Drive: Created new root folder", id);
      this.#cachedFolderId = id;
      return id;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async deleteGraph(url: URL): Promise<Outcome<void>> {
    // The value being deleted might not have been yet added to the cached list. So in order to
    // avoid inconsistencies we first make sure the list is up to date, before removing it.
    await this.#userGraphsList.refresh();
    const file = this.fileIdFromUrl(url);
    try {
      const api = new Files(await DriveOperations.getUserAuth(this.vendor));
      await retryableFetch(api.makeDeleteRequest(file));
      await this.#userGraphsList.invalidateDeleted(file);
    } catch (e) {
      console.warn(e);
      return err("Unable to delete");
    } finally {
      await this.#refreshUserList();
    }
  }

  fileIdFromUrl(url: URL): string {
    return url.href.split("/").at(-1)!;
  }
}

function createAppProperties(
  filename: string,
  descriptor: GraphDescriptor,
  thumbnailUrl: string | undefined
): StoredAppProperties {
  const {
    title = filename,
    description = "",
    metadata: { tags = [] } = {},
  } = descriptor;
  const result: StoredAppProperties = {
    title,
    description,
    tags: JSON.stringify(tags),
    thumbnailUrl: thumbnailUrl ?? "", // undefined here means "do not update".
  };

  // Drive has limit of how long key+value can be in bytes in UTF8 wo we are truncating the values.
  let key: keyof StoredAppProperties;
  for (key in result) {
    result[key] = truncateValueForUtf8(
      key,
      result[key]!,
      MAX_APP_PROPERTY_LENGTH
    );
  }
  return result;
}

function readAppProperties(
  file: DriveFile
): AppProperties & Properties["properties"] {
  const {
    appProperties: { title, description = "", tags, thumbnailUrl } = {},
  } = file;
  let parsedTags = [];
  try {
    parsedTags = tags ? JSON.parse(tags) : [];
    if (!Array.isArray(parsedTags)) parsedTags = [];
  } catch {
    // do nothing.
  }

  return {
    title: title ?? "",
    description,
    tags: parsedTags,
    thumbnailUrl: file.properties?.thumbnailUrl ?? thumbnailUrl,
  };
}

function getFileTitle(descriptor: GraphDescriptor) {
  return descriptor.title || "Untitled Graph";
}

/**
 * Safely quote a string for use in a Drive query. Note this includes the
 * surrounding quotation marks.
 */
function quote(value: string) {
  return `'${value.replace(/'/g, "\\'")}'`;
}

function maybeStripBase64Suffix(contentType: string): string {
  const semiColonIndex = contentType.indexOf(";");
  const result =
    semiColonIndex >= 0 ? contentType.slice(0, semiColonIndex) : contentType;
  return result;
}

export function isDriveFile(url?: string): boolean {
  return !!url && url?.startsWith(PROTOCOL);
}

export function getFileId(driveUrl: string): string {
  if (driveUrl.startsWith(PROTOCOL)) {
    driveUrl = driveUrl.slice(PROTOCOL.length + 1);
    while (driveUrl.startsWith("/")) {
      driveUrl = driveUrl.substring(1);
    }
    // Take the folderId off.
    driveUrl = driveUrl.split("/").at(-1)!;
  }
  return driveUrl;
}

function toGraphInfos(files: Array<DriveFile>): {
  result: Array<GraphInfo>;
  lastModified?: string;
} {
  let lastModified: string | undefined;
  const result = files.map((file: DriveFile) => {
    if (file.modifiedTime && file.modifiedTime > (lastModified ?? "")) {
      lastModified = file.modifiedTime;
    }
    const appProperties = readAppProperties(file);
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

/**
 * Returns thumbnail data from the descriptor - either theme thumbnail or `@@thumbnail`.
 * In case of the latter also returns the holding `asset` so that it can be updated with the new url.
 */
function getThumbnail(descriptor?: GraphDescriptor): {
  data?: string;
  contentType?: string;
  asset?: Asset;
} {
  const presentation = descriptor?.metadata?.visual?.presentation;
  if (presentation && presentation.theme) {
    const theme = presentation.themes?.[presentation.theme];
    if (theme?.isDefaultTheme) {
      return {}; // MAIN_ICON - no need to persist it.
    }
    const handle = theme?.splashScreen?.storedData.handle;
    if (isDriveFile(handle)) {
      return { data: handle };
    }
  }
  // Otherwise use @@thumbnail.
  const asset = descriptor?.assets?.["@@thumbnail"];
  if (!asset) {
    return {};
  }
  const assetData = asset.data as string;
  if (isDriveFile(assetData)) {
    // Already a Drive file.
    return { data: assetData, asset };
  }

  if (assetData) {
    return { ...parseAssetData(assetData), asset };
  }
  return {};
}

function parseAssetData(asset: string): { data: string; contentType: string } {
  // Format: data:<contentType>;base64,<data>
  const lastComma = asset.lastIndexOf(",");
  const colonIndex = asset.indexOf(":");
  const contentType = asset.slice(colonIndex + 1, lastComma);
  const data = asset.slice(lastComma + 1);
  return { data, contentType };
}

function getDriveCacheState(): DriveChangesCacheState | null {
  const state = localStorage.getItem(CHANGE_LIST_START_PAGE_TOKEN_STORAGE_KEY);
  if (!state) {
    return null;
  }
  try {
    const result = JSON.parse(state) as DriveChangesCacheState;
    if (!result.startPageToken || !result.lastFetched) {
      return null;
    }
    return result;
  } catch (e) {
    return null;
  }
}

function setDriveCacheState(
  state: Partial<DriveChangesCacheState> | null
): void {
  if (state) {
    if (!state.startPageToken) {
      throw new Error("DriveChangesCacheState must have a startPageToken set");
    }
    if (state.lastFetched === undefined) {
      state.lastFetched = new Date().toISOString();
    }
    localStorage.setItem(
      CHANGE_LIST_START_PAGE_TOKEN_STORAGE_KEY,
      JSON.stringify(state)
    );
  } else {
    localStorage.removeItem(CHANGE_LIST_START_PAGE_TOKEN_STORAGE_KEY);
  }
}

function stillHoldsState(state: DriveChangesCacheState | null): boolean {
  const current = getDriveCacheState();
  if (!state && !current) {
    return true;
  }

  return state?.lastFetched === current?.lastFetched;
}
