/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type { Asset, GraphTag } from "@breadboard-ai/types";
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

import { truncateValueForUtf8 } from "./utils.js";

const PROTOCOL = "drive:";

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const DEPRECATED_GRAPH_MIME_TYPE = "application/json";

/** Delay between GDrive API retries. */
const RETRY_MS = 200;

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

/** Retries fetch() calls until status is not an internal server error. */
async function retryableFetch(
  input: string | Request,
  init?: RequestInit,
  numRetries = 3
): Promise<Response> {
  function shouldRetry(response: Response): boolean {
    return 500 <= response.status && response.status <= 599;
  }

  async function recursiveHelper(
    retriesLeft: number,
    previousResponse: Response
  ): Promise<Response> {
    if (retriesLeft <= 0) {
      return previousResponse;
    }
    let response: Response | null = null;
    try {
      response = await fetch(input, init);
      if (!shouldRetry(response)) {
        return response;
      }
    } catch (e) {
      // return "403 Forbidden" response, as this is likely a CORS error
      response = new Response(null, {
        status: 403,
        statusText: (e as Error).message,
      });
    }
    return await new Promise((resolve) => {
      setTimeout(async () => {
        console.warn(
          "Retrying GDrive API fetch because of response: ",
          response
        );
        resolve(await recursiveHelper(retriesLeft - 1, response));
      }, RETRY_MS);
    });
  }

  return recursiveHelper(numRetries, new Response(null, { status: 500 }));
}

class DriveOperations {
  readonly #userFolderName: string;
  readonly #publicApiKey?: string;
  readonly #featuredGalleryFolderId?: string;

  /**
   * @param refreshProjectListCallback will be called when project list may have to be updated.
   */
  constructor(
    public readonly vendor: TokenVendor,
    public readonly username: string,
    public readonly url: URL,
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

  async #readDriveFolder(
    folderId: string,
    auth: GoogleApiAuthorization
  ): Promise<Outcome<GraphInfo[]>> {
    // TODO(volodya): Deal with the deleted files.
    // TODO(volodya): Defend against a duplicated values due to race conditions.
    try {
      // Find out if we have a cached value and if so, add the search criteria.
      const cache = await caches.open("DriveOperations");
      const cacheKey = new URL(`http://opals/${folderId}`);
      const cachedResponse = await cache.match(cacheKey);
      const cachedLastModified = cachedResponse?.headers?.get("Last-Modified");
      const query =
        `"${folderId}" in parents` +
        ` and (mimeType="${GRAPH_MIME_TYPE}"` +
        `      or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")` +
        ` and trashed=false` +
        (cachedLastModified
          ? `and modifiedTime > ${JSON.stringify(cachedLastModified)}`
          : "");

      const api = new Files(auth);
      const fileRequest = await retryableFetch(api.makeQueryRequest(query));
      const response: DriveFileQuery = await fileRequest.json();

      // TODO: This is likely due to an auth error.
      if (!("files" in response)) {
        console.warn(response);
        return err(`Unable to get Drive folder contents. Likely an auth error`);
      }

      const cachedList = (await cachedResponse?.json())?.files ?? [];
      response.files.push(...cachedList);

      const { result, lastModified } = toGraphInfos(response.files);
      if (response.files?.length > 0) {
        cache.put(
          // no await.
          cacheKey,
          new Response(
            JSON.stringify({
              files: response.files,
            }),
            {
              headers: {
                "Last-Modified": lastModified ?? "",
              },
            }
          )
        );
      }
      return result;
    } catch (e) {
      console.warn(e);
      return err((e as Error).message);
    }
  }

  async readGraphList(): Promise<Outcome<GraphInfo[]>> {
    const query =
      ` (mimeType="${GRAPH_MIME_TYPE}"` +
      `      or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")` +
      ` and trashed=false`;
    const token = await getAccessToken(this.vendor);
    if (!token) {
      throw new Error("No access token");
    }
    const api = new Files({ kind: "bearer", token });
    const response = await retryableFetch(api.makeQueryRequest(query));
    const result = (await response.json()) as DriveFileQuery;
    return toGraphInfos(result.files).result;
  }

  async readFeaturedGalleryGraphList(): Promise<Outcome<GraphInfo[]>> {
    const folderId = this.#featuredGalleryFolderId;
    if (!folderId) {
      return err(
        "Could not read featured gallery from Google Drive:" +
          " No folder id configured."
      );
    }
    const apiKey = this.#publicApiKey;
    if (!apiKey) {
      return err(
        "Could not read featured gallery from Google Drive:" +
          " No public API key configured."
      );
    }
    const graphInfos = await this.#readDriveFolder(folderId, {
      kind: "key",
      key: apiKey,
    });
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
      await this.refreshProjectListCallback();
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
      await this.refreshProjectListCallback();
    }
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
    const file = this.fileIdFromUrl(url);
    const accessToken = await getAccessToken(this.vendor);
    try {
      const api = new Files({ kind: "bearer", token: accessToken! });
      await retryableFetch(api.makeDeleteRequest(file));
      return;
    } catch (e) {
      console.warn(e);
      return err("Unable to delete");
    } finally {
      await this.refreshProjectListCallback();
    }
  }

  fileIdFromUrl(url: URL) {
    return url.href.replace(
      `${this.url.href}${this.url.pathname ? "" : "/"}`,
      ""
    );
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
    description: description,
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
