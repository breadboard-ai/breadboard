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
  type AppProperties,
  type DriveFile,
  type DriveFileQuery,
  type GoogleApiAuthorization,
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

let alreadyWarnedAboutMissingPublicApiKey = false;

/** Retries fetch() calls until status is not an internal server error. */
async function retriableFetch(
  input: string|Request,
  init?: RequestInit,
  numRetries = 3
): Promise<Response> {
  let response: Response;
  do {
    response = await fetch(input, init);
    numRetries--;
  } while (response.status === 500 && numRetries >= 0);
  return response;
}

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
      const response = await retriableFetch(api.makeGetRequest(folderId));

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
    const folderId = await this.findOrCreateFolder();
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
      const fileRequest = await retriableFetch(api.makeQueryRequest(query));
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
    const fileRequest = await retriableFetch(api.makeQueryRequest(query));
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
    const fileRequest = await retriableFetch(api.makeQueryRequest(query));
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

      await retriableFetch(
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
      const response = await retriableFetch(
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
    const fileRequest = await retriableFetch(api.makeQueryRequest(query));
    const response: DriveFileQuery = await fileRequest.json();
    return response.files.map((file) => file.id);
  }

  async readGraphFromDrive(url: URL): Promise<GraphDescriptor | null> {
    const fileId = url.href.replace(`${this.url.href}/`, "");
    let response = await this.#readFileWithUserAuth(fileId);
    if (response?.status === 404) {
      response = await this.#readFileWithPublicAuth(fileId);
    }
    if (response?.status === 200) {
      const graph = (await response.json()) as GraphDescriptor;
      if (graph && !("error" in graph)) {
        return graph;
      }
    }
    return null;
  }

  async #readFileWithUserAuth(fileId: string): Promise<Response | null> {
    const token = await getAccessToken(this.vendor);
    if (!token) {
      return null;
    }
    return this.#readFile(fileId, { kind: "bearer", token });
  }

  async #readFileWithPublicAuth(fileId: string): Promise<Response | null> {
    if (!this.#publicApiKey) {
      if (!alreadyWarnedAboutMissingPublicApiKey) {
        console.warn(
          "Could not read a potentially public Google Drive file" +
            " because a Google Drive API key was not configured."
        );
        alreadyWarnedAboutMissingPublicApiKey = true;
      }
      return null;
    }
    return this.#readFile(fileId, { kind: "key", key: this.#publicApiKey });
  }

  async #readFile(
    fileId: string,
    authorization: GoogleApiAuthorization
  ): Promise<Response> {
    return retriableFetch(new Files(authorization).makeLoadRequest(fileId));
  }

  async findOrCreateFolder(): Promise<Outcome<string>> {
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
        await retriableFetch(findRequest)
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
        return id;
      }

      const createRequest = api.makeCreateRequest({
        name: GOOGLE_DRIVE_FOLDER_NAME,
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      });
      const { id } = (await (await retriableFetch(createRequest)).json()) as {
        id: string;
      };
      console.log("Google Drive: Created new root folder", id);
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
      await retriableFetch(api.makeDeleteRequest(file));
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
