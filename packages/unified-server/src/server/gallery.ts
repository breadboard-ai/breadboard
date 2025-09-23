/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeGraphListQuery } from "@breadboard-ai/google-drive-kit/board-server/operations.js";
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

export async function makeGalleryMiddleware({
  gallery,
}: GalleryMiddlewareInit): Promise<RequestHandler> {
  const router = Router();
  router.use(cors({ origin: true, credentials: true, maxAge: 24 * 60 * 60 }));

  router.get("/list", async (_: ExpressRequest, res: ExpressResponse) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(gallery.latestGraphFiles));
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
  readonly #query: string;
  readonly #ready: Promise<void>;
  #setIntervalTimerId!: ReturnType<typeof setInterval>;
  #latest!: {
    graphMetadata: Map<string, FeaturedGalleryFile>;
    assetIds: Set<string>;
  };

  private constructor({
    driveClient,
    cacheRefreshSeconds,
  }: CachingFeaturedGalleryInit) {
    const folderId = flags.GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID;
    if (!folderId) {
      throw new Error("GOOGLE_DRIVE_FEATURED_GALLERY_FOLDER_ID not set");
    }
    if (cacheRefreshSeconds <= 0) {
      throw new Error("Cache refresh seconds must be > 0");
    }

    this.#driveClient = driveClient;
    this.#query = makeGraphListQuery({
      kind: "shareable",
      owner: undefined,
      parent: folderId,
    });

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

  async #refresh() {
    const listResult = await this.#driveClient.listFiles(this.#query, {
      fields: ["id", "name", "properties"],
    });
    const graphs: GraphDescriptor[] = await Promise.all(
      listResult.files.map(async (graphFileId) => {
        const response = await this.#driveClient.getFileMedia(graphFileId);
        return (await response.json()) as GraphDescriptor;
      })
    );
    this.#latest = {
      graphMetadata: new Map(listResult.files.map((file) => [file.id, file])),
      assetIds: new Set(
        graphs
          .map((graph) =>
            findGoogleDriveAssetsInGraph(graph).map((asset) => asset.fileId.id)
          )
          .flat()
      ),
    };
    console.log(
      `[gallery middleware] refreshed cache` +
        ` with ${this.#latest.graphMetadata.size} graphs` +
        ` and ${this.#latest.assetIds.size} assets.`
    );
  }

  [Symbol.dispose]() {
    clearInterval(this.#setIntervalTimerId);
  }

  isFeaturedGalleryGraph(fileId: string): boolean {
    return this.#latest.graphMetadata.has(fileId);
  }

  isFeaturedGalleryAsset(fileId: string): boolean {
    return this.#latest.assetIds.has(fileId);
  }

  get latestGraphFiles(): FeaturedGalleryFile[] {
    return [...this.#latest.graphMetadata.values()];
  }
}
