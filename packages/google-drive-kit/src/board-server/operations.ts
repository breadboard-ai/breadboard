/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type { Asset, GraphTag } from "@breadboard-ai/types";
import {
  err,
  type GraphDescriptor,
  type Outcome,
} from "@google-labs/breadboard";
import { getAccessToken } from "./access.js";
import {
  Files,
  type AppProperties,
  type DriveFile,
  type DriveFileQuery,
} from "./api.js";
import { unescape } from "querystring";

export { DriveOperations, PROTOCOL };

const PROTOCOL = "drive:";

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const DEPRECATED_GRAPH_MIME_TYPE = "application/json";

/** Delay between GDrive API retries. */
const RETRY_MS = 200;

export type GraphInfo = {
  id: string;
  title: string;
  tags: GraphTag[];
  thumbnailUrl: string | undefined;
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
    const response = await fetch(input, init);
    if (!shouldRetry(response)) {
      return response;
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

  constructor(
    public readonly vendor: TokenVendor,
    public readonly username: string,
    public readonly url: URL,
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

  async test() {
    const accessToken = await getAccessToken(this.vendor);
    const folderId = await this.findFolder();
    if (!folderId || !accessToken) {
      throw new Error("No folder ID or access token");
    }
    const api = new Files({ kind: "bearer", token: accessToken });
    const query =
      `"${folderId}" in parents and` +
      ` (mimeType="${GRAPH_MIME_TYPE}"` +
      `      or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")` +
      ` and trashed=false`;
    const fileRequest = await retryableFetch(api.makeQueryRequest(query));
    const response: DriveFileQuery = await fileRequest.json();
    return response.files.map((f) => {
      return { id: f.id, appProperties: f.appProperties };
    });
  }

  async readGraphList(): Promise<Outcome<GraphInfo[]>> {
    const folderId = await this.findFolder();
    if (!(typeof folderId === "string" && folderId)) {
      return [];
    }
    const accessToken = await getAccessToken(this.vendor);
    const query =
      `"${folderId}" in parents` +
      ` and (mimeType="${GRAPH_MIME_TYPE}"` +
      `      or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")` +
      ` and trashed=false`;

    if (!folderId || !accessToken) {
      throw new Error("No folder ID or access token");
    }

    try {
      const api = new Files({ kind: "bearer", token: accessToken });
      const fileRequest = await retryableFetch(api.makeQueryRequest(query));
      const response: DriveFileQuery = await fileRequest.json();

      // TODO: This is likely due to an auth error.
      if (!("files" in response)) {
        console.warn(response);
        return err(`Unable to get Drive folder contents. Likely an auth error`);
      }

      const result = response.files.map((file) => toGraphInfo(file));

      return result;
    } catch (e) {
      console.warn(e);
      return err((e as Error).message);
    }
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
    const query =
      `"${folderId}" in parents` +
      ` and (mimeType="${GRAPH_MIME_TYPE}"` +
      `      or mimeType="${DEPRECATED_GRAPH_MIME_TYPE}")` +
      ` and trashed=false`;
    const api = new Files({ kind: "key", key: apiKey });
    const fileRequest = await retryableFetch(api.makeQueryRequest(query));
    const response = (await fileRequest.json()) as DriveFileQuery;
    const results = await Promise.all(
      response.files.map(async (file) => {
        const result = toGraphInfo(file);
        if (!result.tags.includes("featured")) {
          // The fact that a graph is in the featured folder alone determines
          // whether it is featured.
          result.tags.push("featured");
        }
        if (!result.title) {
          result.title = file.name.replace(/(\.bgl)?\.json$/, "");
        }
        return result;
      })
    );
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

  async writeGraphToDrive(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    const file = url.href.replace(`${this.url.href}/`, "");
    const name = getFileTitle(descriptor);
    const accessToken = await getAccessToken(this.vendor);
    try {
      const api = new Files({ kind: "bearer", token: accessToken! });
      const thumbnailUrl = await this.maybeCreateThumbnailFile(
        api,
        name,
        descriptor.assets?.["@@thumbnail"]
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
    }
  }

  async writeNewGraphToDrive(
    url: URL,
    parent: string,
    descriptor: GraphDescriptor
  ) {
    const fileName = url.href.replace(`${this.url.href}/`, "");
    const name = getFileTitle(descriptor);
    const accessToken = await getAccessToken(this.vendor);

    try {
      const api = new Files({ kind: "bearer", token: accessToken! });
      const thumbnailUrl = await this.maybeCreateThumbnailFile(
        api,
        name,
        descriptor.assets?.["@@thumbnail"]
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
    }
  }

  /** Also patches the asset with the url if a file got created.  */
  private async maybeCreateThumbnailFile(
    api: Files,
    graphFileName: string,
    asset?: Asset
  ): Promise<string | undefined> {
    // TODO(volodya): Update the content if the file exists.
    if (!asset) {
      return undefined;
    }
    const assetData = asset.data as string;
    if (assetData?.startsWith(PROTOCOL)) {
      // Already a Drive file.
      return undefined; // No new files were created.
    }
    const name = `${graphFileName} Thumbnail`;
    const { data, contentType } = this.parseAssetData(assetData);
    if (!data) {
      return undefined;
    }
    const response = await retryableFetch(
      api.makeMultipartCreateRequest([
        {
          contentType: "application/json; charset=UTF-8",
          data: {
            name,
            mimeType: maybeStripBase64Suffix(contentType),
            parents: [await this.findOrCreateFolder()],
          },
        },
        { contentType, data },
      ])
    );
    const file: DriveFile = await response.json();
    const thumbnailUrl = `${PROTOCOL}/${file.id}`;

    asset!.data = thumbnailUrl;
    return thumbnailUrl;
  }

  private parseAssetData(asset: string): { data: string; contentType: string } {
    // Format: data:<contentType>;base64,<data>
    const lastComma = asset.lastIndexOf(",");
    const colonIndex = asset.indexOf(":");
    const contentType = asset.slice(colonIndex + 1, lastComma);
    const data = asset.slice(lastComma + 1);
    return { data, contentType };
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
    const file = url.href.replace(`${this.url.href}/`, "");
    const accessToken = await getAccessToken(this.vendor);
    try {
      const api = new Files({ kind: "bearer", token: accessToken! });
      await retryableFetch(api.makeDeleteRequest(file));
      return;
    } catch (e) {
      console.warn(e);
      return err("Unable to delete");
    }
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
  return {
    title,
    description,
    tags: JSON.stringify(tags),
    thumbnailUrl,
  };
}

function readAppProperties(file: DriveFile): AppProperties {
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
    thumbnailUrl,
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

function toGraphInfo(file: DriveFile): GraphInfo {
  const { id, name } = file;
  const { title, tags, thumbnailUrl } = readAppProperties(file);
  return {
    id,
    title: title || name.replace(/(\.bgl)?\.json$/, ""),
    tags,
    thumbnailUrl,
  } satisfies GraphInfo;
}

function maybeStripBase64Suffix(contentType: string): string {
  const semiColonIndex = contentType.indexOf(";");
  const result =
    semiColonIndex >= 0 ? contentType.slice(0, semiColonIndex) : contentType;
  return result;
}