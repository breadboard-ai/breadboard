/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

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
import { type AppProperties } from "./utils.js";

export { DriveOperations, PROTOCOL };

import {
  extractGoogleDriveFileId,
  readProperties,
  truncateValueForUtf8,
} from "./utils.js";
import type { GoogleDriveClient } from "../google-drive-client.js";
import { DriveLookupCache } from "./drive-lookup-cache.js";
import { DriveListCache } from "./drive-list-cache.js";

const PROTOCOL = "drive:";

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
export const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const RUN_RESULTS_MIME_TYPE = "application/vnd.breadboard.run-results+json";
const RUN_RESULTS_GRAPH_URL_APP_PROPERTY = "graphUrl";

// Properties related to sharing graphs.
export const IS_SHAREABLE_COPY_PROPERTY = "isShareableCopy";
export const LATEST_SHARED_VERSION_PROPERTY = "latestSharedVersion";
export const MAIN_TO_SHAREABLE_COPY_PROPERTY = "mainToShareableCopy";
export const SHAREABLE_COPY_TO_MAIN_PROPERTY = "shareableCopyToMain";

const BASE_USER_QUERY = `
  mimeType="${GRAPH_MIME_TYPE}"
  and 'me' in owners
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
  mimeType="${GRAPH_MIME_TYPE}"
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
    private readonly refreshProjectListCallback: () => Promise<void>,
    userFolderName: string,
    googleDriveClient: GoogleDriveClient,
    publishPermissions: gapi.client.drive.Permission[],
    featuredGalleryFolderId?: string
  ) {
    if (!userFolderName) {
      throw new Error(`userFolderName was empty`);
    }
    this.#userFolderName = userFolderName;
    this.#featuredGalleryFolderId = featuredGalleryFolderId;
    this.#googleDriveClient = googleDriveClient;
    this.#publishPermissions = publishPermissions;

    this.#userGraphsList = new DriveListCache(
      "user",
      BASE_USER_QUERY,
      this.#googleDriveClient,
      "user",
      true
    );

    if (featuredGalleryFolderId) {
      this.#featuredGraphsList = new DriveListCache(
        "featured",
        `${BASE_FEATURED_QUERY} and "${featuredGalleryFolderId}" in parents`,
        this.#googleDriveClient,
        "public",
        false
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
          const pageToken =
            await this.#googleDriveClient.getChangesStartPageToken();
          if (!pageToken) {
            // Will be retried next time.
            console.error("Response containing not startPageToken");
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
    const changes: Array<gapi.client.drive.Change> = [];
    let newStartPageToken: string | undefined;
    do {
      let data;
      try {
        data = await this.#googleDriveClient.listChanges({
          pageToken,
          pageSize: 1000,
          includeRemoved: true,
          includeCorpusRemovals: true,
        });
      } catch (e) {
        console.error("Response not OK", e);
        // This may be due to an invalid token, so let's just trash it and retry.
        setDriveCacheState(null);
        throw new Error("Failed to fetch drive changes");
      }

      pageToken = data.nextPageToken!;
      if (data.changes) {
        changes.push(...data.changes);
      }
      if (data.newStartPageToken) {
        // Should be always present, but just in case it's safer not to override the last successful value.
        newStartPageToken = data.newStartPageToken;
      }
    } while (pageToken);
    // TODO(aomarks) Standardize DriveChange type.
    return [changes as DriveChange[], newStartPageToken];
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
    console.assert(
      this.#featuredGraphsList,
      "featuredGalleryFolderId is missing"
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

  async getThumbnailFileId(boardFileId: string): Promise<string | undefined> {
    // There is probably a better way to do this - we need appProperties of the drive file.
    // Those were read during load/listing of the board, however they don't have a place in the
    // data model hence didn't make it to here.
    // Since such requests are cheap and fast it's fine for now.
    // TODO(volodya): Pass the app properties and remove the need for this.
    let file;
    try {
      file = await this.#googleDriveClient.getFileMetadata(boardFileId, {
        fields: ["properties", "appProperties"],
      });
    } catch {
      // TODO(aomarks) We only care about 404. Resultify the drive client, or
      // represent 404 differently.
      return undefined;
    }
    const url = readProperties(file).thumbnailUrl;
    return url ? getFileId(url) : undefined;
  }

  async writeGraphToDrive(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    await purgeStoredDataInMemoryValues(descriptor);
    const file = this.fileIdFromUrl(url);
    const name = getFileTitle(descriptor);
    try {
      const thumbnailUrl = await this.upsertThumbnailFile(
        file,
        name,
        descriptor
      );

      await this.#googleDriveClient.updateFile(
        file,
        new Blob([JSON.stringify(descriptor)], {
          type: GRAPH_MIME_TYPE,
        }),
        {
          name,
          properties: createProperties({
            title: name,
            description: descriptor.description ?? "",
            thumbnailUrl,
            tags: descriptor.metadata?.tags ?? [],
          }),
          mimeType: GRAPH_MIME_TYPE,
        }
      );
      console.debug(`[Google Drive Board Server] Saved graph`, descriptor);

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

    try {
      const thumbnailUrl = await this.upsertThumbnailFile(
        fileName,
        name,
        descriptor
      );

      const file = await this.#googleDriveClient.createFile(
        new Blob([JSON.stringify(descriptor)], { type: GRAPH_MIME_TYPE }),
        {
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
        { fields: ["id"] }
      );
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
    const parentFolderId = await this.findOrCreateFolder();
    if (typeof parentFolderId !== "string" || !parentFolderId) {
      throw new Error(`Unexpected parent folder result ${parentFolderId}`);
    }
    // First try to copy the file with a direct Google Drive copy operation.
    const copiedFile = await this.#googleDriveClient.copyFile(
      fileId,
      { parents: [parentFolderId] },
      { fields: ["id", "resourceKey"] }
    );
    if (copiedFile.ok) {
      return {
        storedData: {
          ...original.storedData,
          handle: `${PROTOCOL}/${copiedFile.value.id}`,
          resourceKey: copiedFile.value.resourceKey,
        },
      };
    } else if (copiedFile.error.status === 404) {
      // If we get a 404, it means the file we tried to copy was not visible
      // with user credentials. But the file might still be visible with public
      // credentials. So, let's fetch the content using a method that
      // automatically uses public credentials, and upload that.
      const content = await this.#googleDriveClient.getFileMedia(fileId);

      const uploadedFile = await this.#googleDriveClient.createFile(
        await content.blob(),
        {
          mimeType: original.storedData.mimeType,
          parents: [parentFolderId],
        },
        { fields: ["id", "resourceKey"] }
      );
      return {
        storedData: {
          ...original.storedData,
          handle: `${PROTOCOL}/${uploadedFile.id}`,
          resourceKey: uploadedFile.resourceKey,
        },
      };
    } else {
      return err(String(copiedFile.error.status));
    }
  }

  async writeRunResults(results: RunResults): Promise<{ id: string }> {
    // TODO(aomarks) It would be nice if this saved within a Results folder.
    // Probably part of a larger organization scheme we should have for the
    // Drive folder.
    const parentFolderId = await this.findOrCreateFolder();
    if (typeof parentFolderId !== "string" || !parentFolderId) {
      throw new Error(`Unexpected parent folder result ${parentFolderId}`);
    }
    const graphFileId = extractGoogleDriveFileId(results.graphUrl);
    return await this.#googleDriveClient.createFile(
      new Blob([JSON.stringify(results)], { type: RUN_RESULTS_MIME_TYPE }),
      {
        name: [`results`, graphFileId, crypto.randomUUID()].join("-") + ".json",
        mimeType: RUN_RESULTS_MIME_TYPE,
        parents: [parentFolderId],
        appProperties: {
          [RUN_RESULTS_GRAPH_URL_APP_PROPERTY]: results.graphUrl,
        },
      }
    );
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

  async saveDataPart(
    part: InlineDataCapabilityPart | StoredDataCapabilityPart
  ): Promise<StoredDataCapabilityPart> {
    // Start in parallel.
    const parentPromise = this.findOrCreateFolder();
    // TODO: Update to retryable.
    let fileId: string | undefined;
    let data: string | undefined;
    let mimeType: string;
    let name: string | undefined;
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
      name = part.inlineData.title;
    }
    const blob = b64toBlob(data, mimeType);
    const filePromise = fileId
      ? this.#googleDriveClient.updateFile(fileId, blob)
      : this.#googleDriveClient.createFile(blob, { mimeType });

    const [file, parent] = await Promise.all([filePromise, parentPromise]);
    if (!parent) {
      throw new Error(`No parent`);
    }
    this.#googleDriveClient.updateFileMetadata(
      file.id,
      {
        name,
      },
      { addParents: [parent as string] }
    );
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
    result.storedData.resourceKey = file.resourceKey;
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

    const thumbnailFileId = await this.getThumbnailFileId(boardFileId);

    if (!data || isUrl(data)) {
      if (thumbnailFileId) {
        this.#imageCache.invalidateId(thumbnailFileId);
        // The user has switched to the default theme - delete the file.
        this.#googleDriveClient
          .deleteFile(thumbnailFileId) // No need to await.
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

    const blob = b64toBlob(data, maybeStripBase64Suffix(contentType ?? ""));
    const file = await (thumbnailFileId
      ? this.#googleDriveClient.updateFile(thumbnailFileId, blob)
      : this.#googleDriveClient.createFile(blob));

    const thumbnailUrl = `${PROTOCOL}/${file.id}`;

    const name = `${graphFileName} Thumbnail`;
    const parent = await parentPromise;
    if (!parent) {
      throw new Error(`No parent`);
    }
    // Don't wait for the response since we don't depend on it
    this.#googleDriveClient.updateFileMetadata(
      file.id,
      { name },
      { addParents: [parent as string] }
    );

    this.#imageCache.invalidateId(file.id);

    if (asset) {
      asset.data = thumbnailUrl;
    }
    return thumbnailUrl;
  }

  #cachedFolderId?: string;

  async findFolder(): Promise<Outcome<string | undefined>> {
    if (this.#cachedFolderId) {
      return this.#cachedFolderId;
    }
    const query =
      `name=${quote(this.#userFolderName)}` +
      ` and mimeType="${GOOGLE_DRIVE_FOLDER_MIME_TYPE}"` +
      ` and trashed=false`;
    const { files } = await this.#googleDriveClient.listFiles(query, {
      fields: ["id"],
      orderBy: [
        {
          field: "createdTime",
          dir: "desc",
        },
      ],
    });
    if (files.length > 0) {
      if (files.length > 1) {
        console.warn(
          "[Google Drive] Multiple candidate root folders found," +
            " picking the first created one arbitrarily:",
          files
        );
      }
      const id = files[0]!.id;
      console.log("[Google Drive] Found existing root folder", id);
      this.#cachedFolderId = id;
      return id;
    }
  }

  async findOrCreateFolder(): Promise<Outcome<string>> {
    const existing = await this.findFolder();
    if (typeof existing === "string" && existing) {
      return existing;
    }

    try {
      const { id } = await this.#googleDriveClient.createFileMetadata(
        { name: this.#userFolderName, mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE },
        { fields: ["id"] }
      );
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
    const fileId = this.fileIdFromUrl(url);
    try {
      await this.#googleDriveClient.deleteFile(fileId);
      await this.#userGraphsList.invalidateDeleted(fileId);
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
  return driveUrl.replace(/\?resourcekey=[^/?&#]*/, "");
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

function b64toBlob(b64Data: string, contentType: string, sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
}
