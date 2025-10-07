/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  makeGraphListQuery,
  quote,
} from "@breadboard-ai/google-drive-kit/board-server/operations.js";
import { findGoogleDriveAssetsInGraph } from "@breadboard-ai/google-drive-kit/board-server/utils.js";
import type {
  GoogleDriveClient,
  NarrowedDriveFile,
} from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { GraphDescriptor } from "@breadboard-ai/types";

import * as flags from "./flags.js";

import cors from "cors";
import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
  type RequestHandler,
} from "express";

export interface GalleryMiddlewareInit {
  gallery: CachingFeaturedGallery;
}

interface MetadataAndGraph {
  metadata: FeaturedGalleryFile;
  graph: GraphDescriptor;
}

export async function makeGalleryMiddleware({
  gallery,
}: GalleryMiddlewareInit): Promise<RequestHandler> {
  const router = Router();
  router.use(cors({ origin: true, credentials: true, maxAge: 24 * 60 * 60 }));

  router.get("/list", async (req: ExpressRequest, res: ExpressResponse) => {
    res.writeHead(200, { "content-type": "application/json" });
    const location =
      new URL(req.url, `http://example.invalid`).searchParams.get("location") ??
      undefined;
    res.end(JSON.stringify(gallery.latestGraphFiles(location)));
  });

  return router;
}

export interface CachingFeaturedGalleryInit {
  driveClient: GoogleDriveClient;
  cacheRefreshSeconds: number;
}

type FeaturedGalleryFile = NarrowedDriveFile<"id" | "name" | "properties">;

export class CachingFeaturedGallery {
  static async makeReady(
    init: CachingFeaturedGalleryInit
  ): Promise<CachingFeaturedGallery> {
    const gallery = new CachingFeaturedGallery(init);
    await gallery.#ready;
    return gallery;
  }

  readonly #driveClient: GoogleDriveClient;
  readonly #folderId: string;
  readonly #ready: Promise<void>;
  #setIntervalTimerId!: ReturnType<typeof setInterval>;
  #latest!: {
    globalMetadata: FeaturedGalleryFile[];
    locationSpecificGraphs: Map<string, FeaturedGalleryFile[]>;
    allGraphIds: Set<string>;
    allAssetIds: Set<string>;
  };

  private constructor({
    driveClient,
    cacheRefreshSeconds,
  }: CachingFeaturedGalleryInit) {
    const folderId = flags.GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID;
    if (!folderId) {
      throw new Error("GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID not set");
    }
    this.#folderId = folderId;
    if (cacheRefreshSeconds <= 0) {
      throw new Error("Cache refresh seconds must be > 0");
    }

    this.#driveClient = driveClient;

    // eslint-disable-next-line no-async-promise-executor
    this.#ready = new Promise<void>(async (resolve) => {
      await this.#refresh();
      this.#setIntervalTimerId = setInterval(
        () => this.#refresh(),
        cacheRefreshSeconds * 1000
      );
      resolve();
    });
  }

  async #listGraphsInFolder(folder: string): Promise<MetadataAndGraph[]> {
    const query = makeGraphListQuery({
      kind: "shareable",
      owner: undefined,
      parent: folder,
    });
    const response = await this.#driveClient.listFiles(query, {
      fields: ["id", "name", "properties"],
    });
    return await Promise.all(
      response.files.map(async (metadata) => {
        const response = await this.#driveClient.getFileMedia(metadata.id);
        const graph = (await response.json()) as GraphDescriptor;
        return { metadata, graph };
      })
    );
  }

  async #listGlobalMetadataAndGraphs(): Promise<MetadataAndGraph[]> {
    const results = await this.#listGraphsInFolder(this.#folderId);
    results.sort(sortGraphsByTitle);
    return results;
  }

  async #listLocationSpecificFolders() {
    const query = `
      mimeType = ${quote(GOOGLE_DRIVE_FOLDER_MIME_TYPE)}
      and trashed = false
      and ${quote(this.#folderId)} in parents
    `;
    const result = await this.#driveClient.listFiles(query, {
      fields: ["id", "name"],
    });
    return result.files;
  }

  async #listLocationSpecificMetadataAndGraphs() {
    const locationSpecificFolders = await this.#listLocationSpecificFolders();
    const entries = await Promise.all(
      locationSpecificFolders.map(
        async ({ id, name: location }) =>
          [location, await this.#listGraphsInFolder(id)] as const
      )
    );
    for (const [, graphs] of entries) {
      graphs.sort(sortGraphsByTitle);
    }
    return new Map(entries);
  }

  async #refresh() {
    const [globalMetadataAndGraphs, locationSpecificMetadataAndGraphs] =
      await Promise.all([
        this.#listGlobalMetadataAndGraphs(),
        this.#listLocationSpecificMetadataAndGraphs(),
      ]);

    const globalMetadata: FeaturedGalleryFile[] = [];
    const allGraphIds = new Set<string>();
    const allAssetIds = new Set<string>();

    for (const { metadata, graph } of globalMetadataAndGraphs) {
      globalMetadata.push(metadata);
      allGraphIds.add(metadata.id);
      for (const asset of findGoogleDriveAssetsInGraph(graph)) {
        allAssetIds.add(asset.fileId.id);
      }
    }

    const locationSpecificGraphs = new Map<string, FeaturedGalleryFile[]>();

    for (const [
      location,
      graphs,
    ] of locationSpecificMetadataAndGraphs.entries()) {
      const locationMetadata: FeaturedGalleryFile[] = [];
      for (const { metadata, graph } of graphs) {
        locationMetadata.push(metadata);
        allGraphIds.add(metadata.id);
        for (const asset of findGoogleDriveAssetsInGraph(graph)) {
          allAssetIds.add(asset.fileId.id);
        }
      }
      locationSpecificGraphs.set(location, locationMetadata);
    }

    this.#latest = {
      globalMetadata,
      locationSpecificGraphs,
      allGraphIds,
      allAssetIds,
    };

    console.log(
      `[gallery middleware] refreshed cache` +
        ` with ${this.#latest.allGraphIds.size} graphs,` +
        ` ${locationSpecificGraphs.size} special geo locations,` +
        ` and ${this.#latest.allAssetIds.size} assets.`
    );
  }

  [Symbol.dispose]() {
    clearInterval(this.#setIntervalTimerId);
  }

  isFeaturedGalleryGraph(fileId: string): boolean {
    return this.#latest.allGraphIds.has(fileId);
  }

  isFeaturedGalleryAsset(fileId: string): boolean {
    return this.#latest.allAssetIds.has(fileId);
  }

  latestGraphFiles(location: string | undefined): FeaturedGalleryFile[] {
    const locationSpecificGraphs = location
      ? (this.#latest.locationSpecificGraphs.get(location) ?? [])
      : [];
    return [...locationSpecificGraphs, ...this.#latest.globalMetadata];
  }
}

function sortGraphsByTitle(a: MetadataAndGraph, b: MetadataAndGraph) {
  const titleA = a.graph.title;
  const titleB = b.graph.title;
  if (titleA && titleB && titleA !== titleB) {
    return titleA.localeCompare(titleB);
  }
  // Fall back to ID for determinism.
  return a.metadata.id.localeCompare(b.metadata.id);
}
