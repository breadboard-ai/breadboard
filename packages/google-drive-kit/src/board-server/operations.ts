/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type {
  Asset,
  GraphTag,
  InlineDataCapabilityPart,
  OutputValues,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import {
  err,
  ok,
  purgeStoredDataInMemoryValues,
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
} from "./api.js";

export { DriveOperations, PROTOCOL };

import {
  extractGoogleDriveFileId,
  readProperties,
  retryableFetch,
  truncateValueForUtf8,
} from "./utils.js";
import type { GoogleDriveClient } from "../google-drive-client.js";
import { DriveLookupCache } from "./drive-lookup-cache.js";
import { DriveListCache } from "./drive-list-cache.js";

const PROTOCOL = "drive:";

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const DEPRECATED_GRAPH_MIME_TYPE = "application/json";
const RUN_RESULTS_MIME_TYPE = "application/vnd.breadboard.run-results+json";
const RUN_RESULTS_GRAPH_URL_APP_PROPERTY = "graphUrl";

// Properties related to sharing graphs.
export const IS_SHAREABLE_COPY_PROPERTY = "isShareableCopy";
export const LATEST_SHARED_VERSION_PROPERTY = "latestSharedVersion";
export const MAIN_TO_SHAREABLE_COPY_PROPERTY = "mainToShareableCopy";
export const SHAREABLE_COPY_TO_MAIN_PROPERTY = "shareableCopyToMain";

const MIME_TYPE_QUERY = `(mimeType="${GRAPH_MIME_TYPE}" or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")`;
const BASE_QUERY = `
  ${MIME_TYPE_QUERY}
  and trashed=false
  and not properties has {
    key = ${quote(IS_SHAREABLE_COPY_PROPERTY)}
    and value = "true"
  }
`;
// For featured gallery, we don't need to check whether it's shareable copy
// just show everything there is, since we likely will actually need to do the
// opposite: only show items that are shareable copies.
// TODO: Once all gallery items all have shareable copy metadata, switch to
// only show items that are shareable copies.
const BASE_FEATURED_QUERY = `
  ${MIME_TYPE_QUERY}
  and trashed=false
`;

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
export type StoredProperties = {
  title?: string;
  description?: string;
  tags?: string;
  thumbnailUrl?: string;
};

export type DriveChange = {
  fileId: string;
  removed?: boolean;
};

type DriveChangesCacheState = {
  startPageToken: string;
  /** Date. */
  lastFetched: string;
};

export type RunResults = {
  graphUrl: string;
  finalOutputValues: OutputValues;
};

function getNextFetchChangesDelay() {
  // -[0..15%] variability reduces the chance separate refreshes would step on each other.
  const variability = 0.15 * DRIVE_FETCH_CHANGES_INTERVAL_MS;
  return Math.round(
    Math.min(
      DRIVE_FETCH_CHANGES_INTERVAL_MS, // Ensure not higher than the interval
      Math.max(0, DRIVE_FETCH_CHANGES_INTERVAL_MS - variability) + // Protect against negative.
        Math.random() * variability
    )
  );
}

function getElapsedMsSinceLastCacheRefresh(
  cacheState: DriveChangesCacheState
): number {
  return Date.now() - Date.parse(cacheState.lastFetched);
}

function formatDelay(delay: number): string {
  return `${Math.round(delay / 1000)}s`;
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
  readonly #googleDriveClient: GoogleDriveClient;
  readonly #publishPermissions: gapi.client.drive.Permission[];

  /**
   * @param refreshProjectListCallback will be called when project list may have to be updated.
   */
  constructor(
    public readonly vendor: TokenVendor,
    public readonly username: string,
    private readonly refreshProjectListCallback: () => Promise<void>,
    userFolderName: string,
    googleDriveClient: GoogleDriveClient,
    publishPermissions: gapi.client.drive.Permission[],
    publicApiKey?: string,
    featuredGalleryFolderId?: string
  ) {
    if (!userFolderName) {
      throw new Error(`userFolderName was empty`);
    }
    this.#userFolderName = userFolderName;
    this.#publicApiKey = publicApiKey;
    this.#featuredGalleryFolderId = featuredGalleryFolderId;
    this.#googleDriveClient = googleDriveClient;
    this.#publishPermissions = publishPermissions;

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
        `"${featuredGalleryFolderId}" in parents and ${BASE_FEATURED_QUERY}`,
        getApiAuth
      );
    }

    this.#setupBackgroundRefresh();
  }

  async #setupBackgroundRefresh() {
    // Initial delay is offset by how much time has already passed since the last refresh.
    let initialDelay = getNextFetchChangesDelay();
    const cacheState = getDriveCacheState();
    if (cacheState) {
      // Protect against negative.
      initialDelay = Math.max(
        1,
        initialDelay - getElapsedMsSinceLastCacheRefresh(cacheState)
      );
    }
    console.info(
      `[Drive Cache] Scheduling update in ${formatDelay(initialDelay)}`
    );
    await this.#scheduleBackgroundRefresh(initialDelay);
  }

  /** Reads list of changes from Google Drive and updates caches. */
  async updateCachesOneTime() {
    return this.#doBackgroundRefresh({ oneOffMode: true });
  }

  /** Invalidates all the caches. */
  async forceRefreshCaches() {
    const promises = [
      this.#userGraphsList.forceRefresh(),
      this.#imageCache.invalidateAllItems(),
    ];
    if (this.#featuredGraphsList) {
      promises.push(this.#featuredGraphsList!.forceRefresh());
    }
    return Promise.all(promises);
  }

  async #scheduleBackgroundRefresh(delay: number) {
    setTimeout(async () => {
      await this.#doBackgroundRefresh();
    }, delay);
  }

  async #doBackgroundRefresh(options?: { oneOffMode?: boolean }) {
    const nextRefreshDelay = getNextFetchChangesDelay();
    const nextRefreshMsg = options?.oneOffMode
      ? ""
      : `Next try in ${formatDelay(nextRefreshDelay)}`;
    // The callback maintains internal consistency even if multiple callbacks come at once,
    // but does its best at avoiding that so that unnecessary requests not get issued to Drive.
    try {
      {
        const driveCacheState = getDriveCacheState();
        if (!driveCacheState) {
          // No changes token yet - we capture one and invalidate all the caches.
          const api = new Files(await DriveOperations.getUserAuth(this.vendor));
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
            console.error("Response containing not startPageToken", response);
            throw new Error(`Response containing not startPageToken`);
          }
          if (stillHoldsState(driveCacheState)) {
            setDriveCacheState({ startPageToken: pageToken });
            // Our token is allocated for the next time, now we purge the caches.
            await this.#userGraphsList.forceRefresh();
            if (this.#featuredGraphsList) {
              await this.#featuredGraphsList!.forceRefresh();
            }
            // Forcefully refreshed the caches - give the heads up to the UI layer.
            await this.refreshProjectListCallback();
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
        !options?.oneOffMode &&
        getElapsedMsSinceLastCacheRefresh(driveCacheState) <
          DRIVE_FETCH_CHANGES_INTERVAL_MS
      ) {
        return; // Too early, or might have been updated concurrently.
      }
      const [changes, newStartPageToken] = await this.#fetchAllChanges(
        driveCacheState.startPageToken
      );

      if (changes?.length > 0) {
        // Run processChanges() in parallel.
        const affectedIdsPromises: Array<Promise<Array<string>>> = [
          this.#userGraphsList.processChanges(changes),
          this.#imageCache.processChanges(changes),
        ];
        if (this.#featuredGraphsList) {
          affectedIdsPromises.push(
            this.#featuredGraphsList.processChanges(changes)
          );
        }
        const affectedFileIDLists = await Promise.all(affectedIdsPromises);
        const affectedFileIds = affectedFileIDLists.reduce(
          (accumulator, value) => accumulator.concat(value),
          []
        );
        if (affectedFileIds.length > 0) {
          await this.refreshProjectListCallback();
        }
        console.info(
          `[Drive Cache] Received ${changes.length} changes affecting ${affectedFileIds.length} files. ` +
            `${nextRefreshMsg}. Affected files:`,
          affectedFileIDLists
        );
      } else {
        console.info(`Drive Cache: No changes. ${nextRefreshMsg}`);
      }
      if (newStartPageToken) {
        // At last we update the new start page token so that the next time we continue from here.
        if (stillHoldsState(driveCacheState)) {
          setDriveCacheState({ startPageToken: newStartPageToken });
        }
      }
    } catch (e) {
      console.warn(
        `[Drive Cache] Exception during refresh. ${nextRefreshMsg}`,
        e
      );
    } finally {
      if (!options?.oneOffMode) {
        await this.#scheduleBackgroundRefresh(nextRefreshDelay);
      }
    }
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
    const appProperties = readProperties(await response.json());
    const url = appProperties.thumbnailUrl;
    return url ? getFileId(url) : undefined;
  }

  async writeGraphToDrive(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    await purgeStoredDataInMemoryValues(descriptor);
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
              properties: createProperties({
                title: name,
                description: descriptor.description ?? "",
                thumbnailUrl,
                tags: descriptor.metadata?.tags ?? [],
              }),
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
      await this.refreshUserList();
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
              properties: createProperties({
                title: name,
                description: descriptor.description ?? "",
                thumbnailUrl,
                tags: descriptor.metadata?.tags ?? [],
              }),
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

      console.log("[Google Drive] Created new board", updatedUrl);
      return { result: true, url: updatedUrl };
    } catch (err) {
      console.warn(err);
      return { result: false, error: "Unable to create" };
    } finally {
      // The above update is a non-atomic operation so refresh after both success or fail.
      await this.refreshUserList();
    }
  }

  async copyDriveFile(
    original: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    const sourceHandle = original.storedData.handle;
    if (!sourceHandle.startsWith(PROTOCOL)) {
      return original;
    }
    const fileId = getFileId(sourceHandle);
    // First try to copy the file with a direct Google Drive copy operation.
    const copiedFile = await this.#googleDriveClient.copyFile(fileId, {
      fields: ["id"],
    });
    if (copiedFile.ok) {
      return {
        storedData: {
          ...original.storedData,
          handle: `${PROTOCOL}/${copiedFile.value.id}`,
        },
      };
    } else if (copiedFile.error.status === 404) {
      // If we get a 404, it means the file we tried to copy was not visible
      // with user credentials. But the file might still be visible with public
      // credentials. So, let's fetch the content using a method that
      // automatically uses public credentials, and upload that.
      const content = await this.#googleDriveClient.getFileMedia(fileId);
      const accessToken = await getAccessToken(this.vendor);
      const api = new Files({ kind: "bearer", token: accessToken! });
      const uploadResponse = await retryableFetch(
        api.makeUploadRequest(
          undefined,
          await content.blob(),
          original.storedData.mimeType
        )
      );
      if (!uploadResponse.ok) {
        return err(String(uploadResponse.status));
      }
      const uploadedFile = (await uploadResponse.json()) as DriveFile;
      return {
        storedData: {
          ...original.storedData,
          handle: `${PROTOCOL}/${uploadedFile.id}`,
        },
      };
    } else {
      return err(String(copiedFile.error.status));
    }
  }

  async writeRunResults(results: RunResults): Promise<{ id: string }> {
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
          appProperties: {
            [RUN_RESULTS_GRAPH_URL_APP_PROPERTY]: results.graphUrl,
          },
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
    const response = await retryableFetch(request);
    return (await response.json()) as { id: string };
  }

  /**
   * Publish the given Google Drive file ID according to this deployment's
   * definition of what "publish permissions" are (e.g. fully public for
   * external, or just certain domains/groups for internal).
   */
  async publishFile(fileId: string): Promise<gapi.client.drive.Permission[]> {
    return await Promise.all(
      this.#publishPermissions.map((permission) =>
        this.#googleDriveClient.createPermission(
          fileId,
          { ...permission, role: "reader" },
          { sendNotificationEmail: false }
        )
      )
    );
  }

  async listRunResultsForGraph(
    graphUrl: string
  ): Promise<Array<{ id: string; createdTime: string }>> {
    const token = await getAccessToken(this.vendor);
    if (!token) {
      throw new Error("No access token");
    }
    const api = new Files({ kind: "bearer", token });
    const query = `
      mimeType = ${quote(RUN_RESULTS_MIME_TYPE)}
      and appProperties has {
        key = ${quote(RUN_RESULTS_GRAPH_URL_APP_PROPERTY)}
        and value = ${quote(graphUrl)}
      }
      and trashed = false
    `;
    const response = await retryableFetch(
      api.makeQueryRequest(query, ["id", "createdTime"], "createdTime desc")
    );
    const result = (await response.json()) as gapi.client.drive.FileList;
    return (result.files ?? []).map(({ id, createdTime }) => ({
      id: id!,
      createdTime: createdTime!,
    }));
  }

  async saveDataPart(
    part: InlineDataCapabilityPart | StoredDataCapabilityPart
  ): Promise<StoredDataCapabilityPart> {
    const accessToken = await getAccessToken(this.vendor);
    const api = new Files({ kind: "bearer", token: accessToken! });
    // Start in parallel.
    const parentPromise = this.findOrCreateFolder();
    // TODO: Update to retryable.
    let fileId: string | undefined;
    let data: string | undefined;
    let mimeType: string;
    if ("storedData" in part) {
      fileId = part.storedData?.handle;
      // TODO(volodya): Add a check if data actually needs to be updated.
      data = part.data;
      if (!data) {
        // The data has been neither loaded nor updated - no-op.
        if (!fileId) {
          // Except when it has never been saved before.
          throw new Error(
            `Internal error: Draft data part doesn't have any data: ${JSON.stringify(part)}`
          );
        }
        return part;
      }
      mimeType = part.storedData.mimeType;
    } else {
      fileId = undefined;
      data = part.inlineData.data;
      mimeType = part.inlineData.mimeType;
    }
    const uploadResponse = await fetch(
      api.makeUploadRequest(fileId, data, mimeType)
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
    const handle = `${PROTOCOL}/${file.id}`;
    let result: StoredDataCapabilityPart;
    if ("inlineData" in part) {
      result = {
        storedData: {
          handle,
          mimeType: part.inlineData.mimeType,
        },
      };
    } else {
      result = part;
      result.storedData.handle = handle;
    }
    result.storedData.contentLength = data?.length;
    // TODO(volodya): Populate contentHash.
    return result;
  }

  async refreshUserList(forceInvalidate = false) {
    // In that order, awating.
    await this.#userGraphsList.refresh(forceInvalidate);
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

    if (!data || isUrl(data)) {
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
      return data;
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
            "[Google Drive] Multiple candidate root folders found," +
              " picking the first one arbitrarily:",
            files
          );
        }
        const id = files[0]!.id;
        console.log("[Google Drive] Found existing root folder", id);
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
      console.log("[Google Drive] Created new root folder", id);
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
      await this.refreshUserList();
    }
  }

  fileIdFromUrl(url: URL): string {
    return url.href.split("/").at(-1)!;
  }
}

/** Creates StoredProperties */
export function createProperties(properties: AppProperties): StoredProperties {
  const result: StoredProperties = {
    title: properties.title,
    description: properties.description,
    tags: JSON.stringify(properties.tags),
    thumbnailUrl: properties.thumbnailUrl, // undefined here means "do not update".
  };

  // Drive has limit of how long key+value can be in bytes in UTF8 wo we are truncating the values.
  let key: keyof StoredProperties;
  for (key in result) {
    if (result[key]) {
      result[key] = truncateValueForUtf8(
        key,
        result[key]!,
        MAX_APP_PROPERTY_LENGTH
      );
    }
  }
  return result;
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
    if (isDriveFile(handle) || isUrl(handle)) {
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
  } catch {
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

function isUrl(s: string | null | undefined) {
  return !!s && (s.startsWith("http://") || s.startsWith("https://"));
}
