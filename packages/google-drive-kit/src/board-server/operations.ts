/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type { GraphTag } from "@breadboard-ai/types";
import {
  err,
  type GraphDescriptor,
  type Outcome,
} from "@google-labs/breadboard";
import { getAccessToken } from "./access.js";
import {
  Files,
  getThumbnailId,
  type AppProperties,
  type DriveFile,
  type DriveFileQuery,
} from "./api.js";

export { DriveOperations, PROTOCOL };

const PROTOCOL = "drive:";

// TODO(aomarks) Make this configurable via a VITE_ env variable.
const GOOGLE_DRIVE_FOLDER_NAME = "Breadboard";
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const DEPRECATED_GRAPH_MIME_TYPE = "application/json";

export type GraphInfo = {
  id: string;
  title: string;
  tags: GraphTag[];
};

class DriveOperations {
  readonly #publicApiKey?: string;
  readonly #featuredGalleryFolderId?: string;

  constructor(
    public readonly vendor: TokenVendor,
    public readonly username: string,
    public readonly url: URL,
    publicApiKey?: string,
    featuredGalleryFolderId?: string
  ) {
    this.#publicApiKey = publicApiKey;
    this.#featuredGalleryFolderId = featuredGalleryFolderId;
  }

  static async readFolder(folderId: string, vendor: TokenVendor) {
    const accessToken = await getAccessToken(vendor);

    try {
      const api = new Files({ kind: "bearer", token: accessToken! });
      const response = await fetch(api.makeGetRequest(folderId));

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
      const fileRequest = await fetch(api.makeQueryRequest(query));
      const response: DriveFileQuery = await fileRequest.json();

      // TODO: This is likely due to an auth error.
      if (!("files" in response)) {
        console.warn(response);
        return err(`Unable to get Drive folder contents. Likely an auth error`);
      }

      const result = response.files.map((file) => {
        const properties = readAppProperties(file);
        return {
          id: file.id,
          title: properties.title ?? file.name,
          tags: properties.tags,
        } satisfies GraphInfo;
      });

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
    const fileRequest = await fetch(api.makeQueryRequest(query));
    const response = (await fileRequest.json()) as DriveFileQuery;
    const results = await Promise.all(
      response.files.map(async (file) => {
        const properties = readAppProperties(file);
        const tags = properties.tags;
        if (!tags.includes("featured")) {
          // The fact that a graph is in the featured folder alone determines
          // whether it is featured.
          tags.push("featured");
        }
        const title =
          properties.title || file.name.replace(/(\.bgl)?\.json$/, "");
        return { id: file.id, title, tags };
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
    const fileRequest = await fetch(api.makeQueryRequest(query));
    const response: DriveFileQuery = await fileRequest.json();
    return response.files.map((file) => file.id);
  }

  private parseAssetData(asset: string): { data: string; contentType: string } {
    // Format: data:<contentType>;base64,<data>
    const lastComma = asset.lastIndexOf(",");
    const colonIndex = asset.indexOf(":");
    const semicolonIndex = asset.indexOf(";");
    const contentType = asset.slice(colonIndex + 1, semicolonIndex);
    const data = asset.slice(lastComma + 1);
    return { data, contentType };
  }

  private makeBlobUpsertRequest(
    blobId: string,
    body: string,
    contentType: string
  ): Request {
    return new Request(`/board/blobs/${blobId}`, {
      method: "PATCH",
      body: JSON.stringify({
        body,
        contentType,
      }),
    });
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
      const thumbnail = descriptor.assets?.["@@thumbnail"]?.data;
      let maybeSaveThumbnailPromise: Promise<Response> | undefined;
      console.assert(
        typeof thumbnail === "string",
        "Thumbnail is not a string",
        thumbnail
      );
      if (thumbnail && typeof thumbnail === "string") {
        const { data, contentType } = this.parseAssetData(thumbnail as string);
        // Blob ID is the ID of the Google Drive file. This allows lookup without additional query to the Drive API during listing.
        const blobId = getThumbnailId(url);

        // Holding the promise and awaiting below so that the two requests can run in parallel.
        maybeSaveThumbnailPromise = fetch(
          this.makeBlobUpsertRequest(blobId, data, contentType)
        );
      }

      await fetch(
        api.makePatchRequest(
          file,
          {
            name,
            ...createAppProperties(file, descriptor),
            mimeType: GRAPH_MIME_TYPE,
          },
          descriptor
        )
      );

      if (maybeSaveThumbnailPromise) {
        await maybeSaveThumbnailPromise;
      }

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
      const response = await fetch(
        api.makeMultipartCreateRequest(
          {
            name,
            mimeType: GRAPH_MIME_TYPE,
            parents: [parent],
            ...createAppProperties(fileName, descriptor),
          },
          descriptor
        )
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

  async listAssets(): Promise<string[]> {
    const accessToken = await getAccessToken(this.vendor);
    if (!accessToken) {
      throw new Error("No folder ID or access token");
    }
    const query = `(mimeType contains 'image/')` + ` and trashed=false`;
    const api = new Files({ kind: "bearer", token: accessToken });
    const fileRequest = await fetch(api.makeQueryRequest(query));
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
      `name="${GOOGLE_DRIVE_FOLDER_NAME}"` +
        ` and mimeType="${GOOGLE_DRIVE_FOLDER_MIME_TYPE}"` +
        ` and trashed=false`
    );
    try {
      const { files } = (await (
        await fetch(findRequest)
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
      name: GOOGLE_DRIVE_FOLDER_NAME,
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    });
    try {
      const { id } = (await (await fetch(createRequest)).json()) as {
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
      await fetch(api.makeDeleteRequest(file));
      return;
    } catch (e) {
      console.warn(e);
      return err("Unable to delete");
    }
  }
}

function createAppProperties(
  filename: string,
  descriptor: GraphDescriptor
): AppProperties {
  const {
    title = filename,
    description = "",
    metadata: { tags = [] } = {},
  } = descriptor;
  return {
    appProperties: {
      title,
      description,
      tags: JSON.stringify(tags),
    },
  };
}

function readAppProperties(file: DriveFile): {
  title: string;
  description: string;
  tags: GraphTag[];
} {
  const { appProperties: { title, description = "", tags } = {} } = file;
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
  };
}

function getFileTitle(descriptor: GraphDescriptor) {
  return descriptor.title || "Untitled Graph";
}
