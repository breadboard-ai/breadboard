/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import { isStoredData } from "@breadboard-ai/utils";
import {
  type BoardServer,
  type BoardServerCapabilities,
  type BoardServerEventTarget,
  type DataPartTransformer,
  type GraphDescriptor,
  type GraphProviderCapabilities,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import {
  type DriveFileId,
  type GoogleDriveClient,
} from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { GoogleDriveDataPartTransformer } from "./data-part-transformer.js";
import {
  extractGoogleDriveFileId,
  findGoogleDriveAssetsInGraph,
  readProperties,
  type AppProperties,
} from "@breadboard-ai/utils/google-drive/utils.js";
import { RefreshEvent, SaveEvent } from "./events.js";
import {
  DriveOperations,
  getFileId,
  getThumbnail,
  PROTOCOL,
} from "@breadboard-ai/utils/google-drive/operations.js";
import { SaveDebouncer } from "./save-debouncer.js";
import { DriveGalleryGraphCollection } from "./gallery-graph-collection.js";
import { DriveUserGraphCollection } from "./user-graph-collection.js";
import type { SignInInfo } from "@breadboard-ai/types/sign-in-info.js";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

export { GoogleDriveBoardServer };

// This whole package should probably be called
// "@breadboard-ai/google-drive-board-server".
// But it's good that we have both components and the board server here:
// Good use case.
class GoogleDriveBoardServer
  extends (EventTarget as BoardServerEventTarget)
  implements BoardServer
{
  static PROTOCOL = PROTOCOL;

  public readonly url = new URL(PROTOCOL);
  public readonly capabilities: BoardServerCapabilities;
  public readonly ops: DriveOperations;
  readonly #googleDriveClient: GoogleDriveClient;
  readonly #loadedGraphMetadata = new Map<
    string,
    { isMine: boolean; latestSharedVersion: number }
  >();

  /**
   * Graphs that are actively being created in the background right now.
   *
   * The create method doesn't actually block on the entire create operation
   * completing (which can take ~5s); instead it only blocks on allocating a
   * file ID (which takes ~100ms), and stores the initial descriptor and a
   * promise of create completion in this map.
   *
   * The load method then returns the initial descriptor directly from this map,
   * until the next mutation invalidates it. The mutating methods (create and
   * delete) block on these pending creates, and then clear the entry.
   *
   * This lets the user start editing a newly created graph almost immediately.
   */
  readonly #pendingCreates = new Map<
    string,
    {
      descriptor: GraphDescriptor;
      createDone: Promise<void>;
    }
  >();

  readonly galleryGraphs: DriveGalleryGraphCollection;
  readonly userGraphs: DriveUserGraphCollection;

  constructor(
    public readonly name: string,
    signInInfo: SignInInfo,
    googleDriveClient: GoogleDriveClient,
    publishPermissions: gapi.client.drive.Permission[],
    userFolderName: string,
    findUserOpalFolder: OpalShellHostProtocol["findUserOpalFolder"],
    listUserOpals: OpalShellHostProtocol["listUserOpals"]
  ) {
    super();

    const configuration = {
      url: new URL(`${PROTOCOL}/`),
      capabilities: {
        events: true,
        autosave: true,
      },
    };
    this.ops = new DriveOperations(
      async () => {
        this.dispatchEvent(new RefreshEvent());
      },
      userFolderName,
      googleDriveClient,
      publishPermissions,
      findUserOpalFolder
    );

    this.capabilities = configuration.capabilities;
    this.#googleDriveClient = googleDriveClient;
    this.galleryGraphs = new DriveGalleryGraphCollection(
      signInInfo,
      googleDriveClient.fetchWithCreds
    );
    this.userGraphs = new DriveUserGraphCollection(listUserOpals);
  }

  #saving = new Map<string, SaveDebouncer>();

  #googleDriveClientSeeded?: Promise<void>;
  async #seedGoogleDriveClientWithFeaturedGraphIdsOnce() {
    return (this.#googleDriveClientSeeded ??= (async () => {
      await this.galleryGraphs.loaded;
      for (const [, graph] of this.galleryGraphs.entries()) {
        const driveId = extractGoogleDriveFileId(graph.url);
        if (driveId) {
          this.#googleDriveClient.markFileForReadingWithPublicProxy(driveId);
        }
      }
    })());
  }

  /**
   * See {@link GoogleDriveBoardServer.#pendingCreates} for explanation.
   */
  async #waitForPendingCreateAndInvalidateItIfNeeded(url: URL): Promise<void> {
    const pendingCreate = this.#pendingCreates.get(url.href);
    if (pendingCreate) {
      await pendingCreate.createDone;
      this.#pendingCreates.delete(url.href);
    }
  }

  async #isGalleryGraphFile(fileId: string): Promise<boolean> {
    await this.galleryGraphs.loaded;
    return this.galleryGraphs.has(fileId);
  }

  isMine(url: URL): boolean {
    return this.#loadedGraphMetadata.get(url.href)?.isMine || false;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    if (!url.href.startsWith(PROTOCOL)) {
      return false;
    }

    const metadata = this.#loadedGraphMetadata.get(url.href);

    // We recognize it as something that can be loaded from this Board Server,
    // but we can't assess the access for it, so assume loading alone is
    // acceptable.
    if (!metadata) {
      return {
        load: true,
        save: false,
        delete: false,
      };
    }

    return {
      load: true,
      save: metadata.isMine,
      delete: metadata.isMine,
    };
  }

  getLatestSharedVersion(url: URL): number {
    return this.#loadedGraphMetadata.get(url.href)?.latestSharedVersion ?? -1;
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    // Fast path for just-created graphs. See #pendingCreates for more details.
    const pendingCreate = this.#pendingCreates.get(url.href);
    if (pendingCreate) {
      return pendingCreate.descriptor;
    }

    const fileId: DriveFileId = {
      id: getFileId(url.href),
      resourceKey: url.searchParams.get("resourcekey") ?? undefined,
    };
    await this.#seedGoogleDriveClientWithFeaturedGraphIdsOnce();
    const [metadata, media, isGalleryGraph] = await Promise.all([
      this.#googleDriveClient
        .getFileMetadata(fileId, { fields: ["ownedByMe", "properties"] })
        // TODO(aomarks) GoogleDriveClient.getFileMetadata should itself return
        // undefined on 404, instead of always throwing.
        .catch(() => undefined),
      this.#googleDriveClient.getFileMedia(fileId),
      this.#isGalleryGraphFile(fileId.id),
    ]);
    if (metadata && media.status === 200) {
      const descriptor = await media.json();
      console.debug(`[Google Drive Board Server] Loaded graph`, descriptor);
      if (isGalleryGraph) {
        for (const asset of findGoogleDriveAssetsInGraph(descriptor)) {
          this.#googleDriveClient.markFileForReadingWithPublicProxy(
            asset.fileId.id
          );
        }
      }
      this.#loadedGraphMetadata.set(url.href, {
        isMine: metadata.ownedByMe,
        latestSharedVersion: getLatestSharedVersionFromDriveProperties(
          readProperties(metadata)
        ),
      });
      return descriptor;
    } else if (media.status === 404) {
      return null;
    } else {
      throw new Error(
        `Received ${media.status} error loading graph from Google Drive` +
          ` with file id ${JSON.stringify(fileId)}: ${await media.text()}`
      );
    }
  }

  async flushSaveQueue(url: string): Promise<void> {
    const create = this.#pendingCreates.get(url);
    if (create) {
      await create.createDone;
    }
    const debouncer = this.#saving.get(url);
    if (!debouncer) {
      return;
    }
    await debouncer.flush();
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor,
    userInitiated: boolean
  ): Promise<{ result: boolean; error?: string }> {
    await this.#waitForPendingCreateAndInvalidateItIfNeeded(url);

    let saving = this.#saving.get(url.href);
    if (!saving) {
      saving = new SaveDebouncer(this.ops, {
        savestatuschange: (status, url) => {
          this.dispatchEvent(new SaveEvent(status, url));
        },
      });
      this.#saving = this.#saving.set(url.href, saving);
    }
    saving.save(url, descriptor, userInitiated);
    // TODO(aomarks) We should probably wait for the save debouncer.
    this.userGraphs.put({
      url: url.href,
      title: descriptor.title,
      description: descriptor.description,
      thumbnail: getThumbnail(descriptor).data,
      mine: true,
      readonly: false,
      handle: null,
    });
    return { result: true };
  }

  readonly #createdDuringThisSession = new Set<string>();

  createdDuringThisSession(url: URL): boolean {
    return this.#createdDuringThisSession.has(url.href);
  }

  async create(
    _url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string; url?: string }> {
    const url = await this.createURL();
    this.#createdDuringThisSession.add(url);

    const createDone = (async (): Promise<void> => {
      const parent = await this.ops.findOrCreateFolder();
      if (!ok(parent)) {
        console.error(
          `[drive board server] Error creating parent`,
          parent.$error
        );
        return;
      }
      const writing = await this.ops.writeNewGraphToDrive(
        new URL(url),
        parent,
        descriptor
      );
      if (writing.error) {
        console.error(
          `[drive board server] Error writing graph`,
          writing.error
        );
        return;
      }
      this.userGraphs.put({
        url,
        title: descriptor.title,
        description: descriptor.description,
        thumbnail: getThumbnail(descriptor).data,
        mine: true,
        readonly: false,
        handle: null,
      });
    })();

    this.#pendingCreates.set(url, { descriptor, createDone });
    this.#loadedGraphMetadata.set(url, {
      isMine: true,
      latestSharedVersion: -1,
    });
    return { result: true, url };
  }

  async deepCopy(_url: URL, graph: GraphDescriptor): Promise<GraphDescriptor> {
    const graphCopy = structuredClone(graph);
    const assets = findGoogleDriveAssetsInGraph(graphCopy);
    await Promise.all(
      assets.map(async (asset) => {
        // Only copy managed assets, such as themes and directly uploaded files,
        // which are intrinsic to the graph. Unmanaged assets are references to
        // existing files that were picked from Drive. We don't want to copy
        // those by default, because:
        //
        // 1. The file might have restrictive sharing, and we don't want to make
        //    it too easy to expand access by copying and publishing.
        //
        // 2. The file might be a common source-of-truth, like a shared prompt
        //    guidelines doc, and we don't want to duplicate that.
        if (isStoredData(asset.part) && asset.managed) {
          const assetPartCopy = await this.ops.copyDriveFile(asset.part);
          if (ok(assetPartCopy)) {
            Object.assign(asset.part, assetPartCopy);
          }
        }
      })
    );
    return graphCopy;
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    await this.#waitForPendingCreateAndInvalidateItIfNeeded(url);

    this.#saving.get(url.href)?.cancelPendingSave();
    const deleting = await this.ops.deleteGraph(url);
    if (!ok(deleting)) {
      return { result: false, error: deleting.$error };
    }
    this.userGraphs.delete(url.href);
    return { result: true };
  }

  async createURL(): Promise<string> {
    const fileId = (await this.#googleDriveClient.generateIds(1))[0];
    return `drive:/${fileId}`;
  }

  dataPartTransformer(): DataPartTransformer {
    return new GoogleDriveDataPartTransformer(this.ops);
  }
}

function getLatestSharedVersionFromDriveProperties(
  properties: AppProperties
): number {
  if (properties.latestSharedVersion) {
    const version = Number.parseInt(properties.latestSharedVersion, 10);
    if (!Number.isNaN(version)) {
      return version;
    }
  }
  return -1;
}
