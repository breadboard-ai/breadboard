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
import type { TokenVendor } from "@breadboard-ai/connection-client";

const PROTOCOL = "drive:";

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder";
export const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const RUN_RESULTS_MIME_TYPE = "application/vnd.breadboard.run-results+json";
const RUN_RESULTS_GRAPH_URL_APP_PROPERTY = "graphUrl";

// Properties related to sharing graphs.
export const IS_SHAREABLE_COPY_PROPERTY = "isShareableCopy";
export const LATEST_SHARED_VERSION_PROPERTY = "latestSharedVersion";
export const MAIN_TO_SHAREABLE_COPY_PROPERTY = "mainToShareableCopy";
export const SHAREABLE_COPY_TO_MAIN_PROPERTY = "shareableCopyToMain";

export interface MakeGraphListQueryInit {
  kind: "editable" | "shareable";
  owner: "me" | undefined;
  parent: string | undefined;
}

export function makeGraphListQuery({
  kind,
  owner,
  parent,
}: MakeGraphListQueryInit) {
  return `
    mimeType = ${quote(GRAPH_MIME_TYPE)}
    and trashed = false
    and ${kind === "editable" ? "not" : ""} properties has {
      key = ${quote(IS_SHAREABLE_COPY_PROPERTY)}
      and value = "true"
    }
    ${owner ? `and ${quote(owner)} in owners` : ""}
    ${parent ? `and ${quote(parent)} in parents` : ""}
  `;
}

// These must be in sync with image.ts:*
const DRIVE_IMAGE_CACHE_NAME = "GoogleDriveImages";
const DRIVE_IMAGE_CACHE_KEY_PREFIX = "http://drive-image/";

const MAX_APP_PROPERTY_LENGTH = 124;

export type GraphInfo = {
  id: string;
  title: string;
  tags: GraphTag[];
  thumbnail: string | undefined;
  description: string;
  latestSharedVersion?: string;
};

/** Defines api.ts:AppProperties as stored in the drive file */
export type StoredProperties = {
  title?: string;
  description?: string;
  tags?: string;
  thumbnailUrl?: string;
  latestSharedVersion?: string;
};

export type DriveChange = {
  fileId: string;
  removed?: boolean;
};

export type RunResults = {
  graphUrl: string;
  finalOutputValues: OutputValues;
};

class DriveOperations {
  readonly #userFolderName: string;
  readonly #imageCache = new DriveLookupCache(
    DRIVE_IMAGE_CACHE_NAME,
    DRIVE_IMAGE_CACHE_KEY_PREFIX
  );
  readonly #googleDriveClient: GoogleDriveClient;
  readonly #publishPermissions: gapi.client.drive.Permission[];
  readonly #tokenVendor: TokenVendor;

  /**
   * @param refreshProjectListCallback will be called when project list may have to be updated.
   */
  constructor(
    private readonly refreshProjectListCallback: () => Promise<void>,
    userFolderName: string,
    googleDriveClient: GoogleDriveClient,
    publishPermissions: gapi.client.drive.Permission[],
    tokenVendor: TokenVendor
  ) {
    if (!userFolderName) {
      throw new Error(`userFolderName was empty`);
    }
    this.#userFolderName = userFolderName;
    this.#googleDriveClient = googleDriveClient;
    this.#publishPermissions = publishPermissions;
    this.#tokenVendor = tokenVendor;
  }

  /** Invalidates all the caches. */
  async forceRefreshCaches() {
    await this.#imageCache.invalidateAllItems();
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
    }
  }

  async writeNewGraphToDrive(
    url: URL,
    parent: string,
    descriptor: GraphDescriptor
  ) {
    const fileId = getFileId(url.href);
    const fileName = crypto.randomUUID();
    const name = getFileTitle(descriptor);

    try {
      const thumbnailUrl = await this.upsertThumbnailFile(
        fileName,
        name,
        descriptor
      );

      await this.#googleDriveClient.createFile(
        new Blob([JSON.stringify(descriptor)], { type: GRAPH_MIME_TYPE }),
        {
          id: fileId,
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

      console.log("[Google Drive] Created new board", url.href);
      return { result: true, url: url.href };
    } catch (err) {
      console.warn(err);
      return { result: false, error: "Unable to create" };
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
    const fileId = this.fileIdFromUrl(url);
    try {
      await this.#googleDriveClient.deleteFile(fileId);
    } catch (e) {
      console.warn(e);
      return err("Unable to delete");
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
    latestSharedVersion: properties.latestSharedVersion,
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
export function quote(value: string) {
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
export function getThumbnail(descriptor?: GraphDescriptor): {
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
