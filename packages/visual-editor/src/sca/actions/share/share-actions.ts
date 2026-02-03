/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import {
  diffAssetReadPermissions,
  extractGoogleDriveFileId,
  findGoogleDriveAssetsInGraph,
  permissionMatchesAnyOf,
  type GoogleDriveAsset,
} from "@breadboard-ai/utils/google-drive/utils.js";
import {
  DRIVE_PROPERTY_IS_SHAREABLE_COPY,
  DRIVE_PROPERTY_LATEST_SHARED_VERSION,
  DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY,
  DRIVE_PROPERTY_OPAL_SHARE_SURFACE,
  DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN,
} from "@breadboard-ai/utils/google-drive/operations.js";
import { GoogleDriveBoardServer } from "../../../board-server/server.js";
import { makeAction } from "../binder.js";
import type { UnmanagedAssetProblem } from "../../controller/subcontrollers/editor/share-controller.js";

export const bind = makeAction();

export async function readPublishedState(
  graph: GraphDescriptor | undefined,
  publishPermissions: gapi.client.drive.Permission[]
): Promise<void> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  const graphUrl = graph?.url;
  if (!graphUrl) {
    console.error(`No graph url`);
    return;
  }
  const thisFileId = getGraphFileId(graphUrl);
  if (!thisFileId) {
    console.error(`No file id`);
    return;
  }
  if (!googleDriveClient) {
    console.error(`No google drive client provided`);
    return;
  }
  if (!boardServer) {
    console.error(`No board server provided`);
    return;
  }
  if (!(boardServer instanceof GoogleDriveBoardServer)) {
    console.error(`Provided board server was not Google Drive`);
    return;
  }

  share.state = { status: "loading" };

  // Ensure any pending changes are saved so that our Drive operations will be
  // synchronized with those changes.
  await boardServer.flushSaveQueue(graphUrl);

  const thisFileMetadata = await googleDriveClient.getFileMetadata(
    thisFileId,
    {
      fields: ["resourceKey", "properties", "ownedByMe", "version"],
      // Sometimes we are working on the featured gallery items themselves. In
      // that case, and for all such calls in this file, we should never use
      // the gallery proxy, because otherwise we will get responses that are
      // (1) potentially stale because of caching, (2) missing data because
      // we're not using the owning user's credentials (e.g. permissions get
      // masked out and appear empty).
      bypassProxy: true,
    }
  );

  const thisFileIsAShareableCopy =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN] !==
    undefined;
  if (thisFileIsAShareableCopy) {
    share.state = {
      status: "readonly",
      shareableFile: {
        id: thisFileId,
        resourceKey: thisFileMetadata.resourceKey,
      },
    };
    return;
  }

  const shareableCopyFileId =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY];

  if (!thisFileMetadata.ownedByMe) {
    share.state = {
      status: "readonly",
      shareableFile: shareableCopyFileId
        ? {
          id: shareableCopyFileId,
          resourceKey: (
            await googleDriveClient.getFileMetadata(
              shareableCopyFileId,
              {
                fields: ["resourceKey"],
                bypassProxy: true,
              }
            )
          ).resourceKey,
        }
        : {
          id: thisFileId,
          resourceKey: thisFileMetadata.resourceKey,
        },
    };
    return;
  }

  if (!shareableCopyFileId) {
    share.state = {
      status: "writable",
      published: false,
      granularlyShared: false,
      shareableFile: undefined,
      latestVersion: thisFileMetadata.version,
      userDomain: (await services.signinAdapter.domain) ?? "",
    };
    return;
  }

  const shareableCopyFileMetadata =
    await googleDriveClient.getFileMetadata(shareableCopyFileId, {
      fields: ["resourceKey", "properties", "permissions"],
      bypassProxy: true,
    });
  const allGraphPermissions = shareableCopyFileMetadata.permissions ?? [];
  const diff = diffAssetReadPermissions({
    actual: allGraphPermissions,
    expected: publishPermissions,
  });

  share.state = {
    status: "writable",
    published: diff.missing.length === 0,
    publishedPermissions: allGraphPermissions.filter((permission) =>
      permissionMatchesAnyOf(
        permission,
        publishPermissions
      )
    ),
    granularlyShared:
      // We're granularly shared if there is any permission that is neither
      // one of the special publish permissions, nor the owner (since there
      // will always an owner).
      diff.excess.find((permission) => permission.role !== "owner") !==
      undefined,
    shareableFile: {
      id: shareableCopyFileId,
      resourceKey: shareableCopyFileMetadata.resourceKey,
      stale:
        thisFileMetadata.version !==
        shareableCopyFileMetadata.properties?.[
        DRIVE_PROPERTY_LATEST_SHARED_VERSION
        ],
      permissions: shareableCopyFileMetadata.permissions ?? [],
      shareSurface:
        shareableCopyFileMetadata.properties?.[
        DRIVE_PROPERTY_OPAL_SHARE_SURFACE
        ],
    },
    latestVersion: thisFileMetadata.version,
    userDomain: (await services.signinAdapter.domain) ?? "",
  };

  console.debug(
    `[Sharing] Found sharing state:` +
    ` ${JSON.stringify(share.state, null, 2)}`
  );
}

function getGraphFileId(graphUrl: string): string | undefined {
  if (!graphUrl.startsWith("drive:")) {
    console.error(
      `Expected "drive:" prefixed graph URL, got ${JSON.stringify(graphUrl)}`
    );
    return undefined;
  }
  const graphFileId = graphUrl.replace(/^drive:\/*/, "");
  if (!graphFileId) {
    console.error(`Graph file ID was empty`);
  }
  return graphFileId;
}

export interface MakeShareableCopyResult {
  shareableCopyFileId: string;
  shareableCopyResourceKey: string | undefined;
  newMainVersion: string;
}

export async function makeShareableCopy(
  graph: GraphDescriptor | undefined,
  shareSurface: string | undefined
): Promise<MakeShareableCopyResult> {
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  if (!googleDriveClient) {
    throw new Error(`No google drive client provided`);
  }
  if (!boardServer) {
    throw new Error(`No board server provided`);
  }
  if (!(boardServer instanceof GoogleDriveBoardServer)) {
    throw new Error(`Provided board server was not Google Drive`);
  }
  if (!graph) {
    throw new Error(`Graph was not provided`);
  }
  if (!graph.url) {
    throw new Error(`Graph had no URL`);
  }
  const mainFileId = extractGoogleDriveFileId(graph.url);
  if (!mainFileId) {
    throw new Error(
      `Graph URL did not contain a Google Drive file id: ${graph.url}`
    );
  }

  const shareableFileName = `${mainFileId}-shared.bgl.json`;
  const shareableGraph = structuredClone(graph);
  delete shareableGraph["url"];

  const createResult = await boardServer.create(
    // Oddly, the title of the file is extracted from a URL that is passed in,
    // even though URLs of this form are otherwise totally invalid.
    //
    // TODO(aomarks) This doesn't seem to actually work. The title is in fact
    // taken from the descriptor. So what is the purpose of passing a URL
    // here?
    new URL(`drive:/${shareableFileName}`),
    shareableGraph
  );
  const shareableCopyFileId = extractGoogleDriveFileId(
    createResult.url ?? ""
  );
  if (!shareableCopyFileId) {
    console.error(`Unexpected create result`, createResult);
    throw new Error(`Error creating shareable file`);
  }

  // Update the latest version property on the main file.
  const updateMainResult = await googleDriveClient.updateFileMetadata(
    mainFileId,
    {
      properties: {
        [DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY]: shareableCopyFileId,
      },
    },
    { fields: ["version"] }
  );

  // Ensure the creation of the copy has fully completed.
  //
  // TODO(aomarks) Move more sharing logic into board server so that this
  // create/update coordination doesn't need to be a concern of this
  // component.
  await boardServer.flushSaveQueue(`drive:/${shareableCopyFileId}`);

  const shareableCopyMetadata =
    await googleDriveClient.updateFileMetadata(
      shareableCopyFileId,
      {
        properties: {
          [DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN]: mainFileId,
          [DRIVE_PROPERTY_LATEST_SHARED_VERSION]: updateMainResult.version,
          [DRIVE_PROPERTY_IS_SHAREABLE_COPY]: "true",
          ...(shareSurface
            ? { [DRIVE_PROPERTY_OPAL_SHARE_SURFACE]: shareSurface }
            : {}),
        },
      },
      { fields: ["resourceKey"] }
    );

  console.debug(
    `[Sharing] Made a new shareable graph copy "${shareableCopyFileId}"` +
    ` at version "${updateMainResult.version}".`
  );
  return {
    shareableCopyFileId,
    shareableCopyResourceKey: shareableCopyMetadata.resourceKey,
    newMainVersion: updateMainResult.version,
  };
}

export async function handleAssetPermissions(
  graphFileId: string,
  graph: GraphDescriptor | undefined
): Promise<void> {
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;

  const assets = getAssets(graph);
  if (assets.length === 0) {
    return;
  }
  const managedAssets: GoogleDriveAsset[] = [];
  const unmanagedAssets: GoogleDriveAsset[] = [];
  for (const asset of assets) {
    if (asset.managed) {
      managedAssets.push(asset);
    } else {
      unmanagedAssets.push(asset);
    }
  }

  if (!googleDriveClient) {
    throw new Error(`No google drive client provided`);
  }
  const graphPermissions =
    (
      await googleDriveClient.getFileMetadata(graphFileId, {
        fields: ["permissions"],
        bypassProxy: true,
      })
    ).permissions ?? [];
  await Promise.all([
    autoSyncManagedAssetPermissions(managedAssets, graphPermissions),
    checkUnmanagedAssetPermissionsAndMaybePromptTheUser(
      unmanagedAssets,
      graphPermissions
    ),
  ]);
}

async function autoSyncManagedAssetPermissions(
  managedAssets: GoogleDriveAsset[],
  graphPermissions: gapi.client.drive.Permission[]
): Promise<void> {
  if (managedAssets.length === 0) {
    return;
  }
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;
  if (!googleDriveClient) {
    throw new Error(`No google drive client provided`);
  }
  await Promise.all(
    managedAssets.map(async (asset) => {
      const { capabilities, permissions: assetPermissions } =
        await googleDriveClient.getFileMetadata(asset.fileId, {
          fields: ["capabilities", "permissions"],
          bypassProxy: true,
        });
      if (!capabilities.canShare || !assetPermissions) {
        console.error(
          `[Sharing] Could not add permission to asset ` +
          `"${asset.fileId.id}" because the current user does not have` +
          ` sharing capability on it. Users who don't already have` +
          ` access to this asset may not be able to run this graph.`
        );
        return;
      }
      const { missing, excess } = diffAssetReadPermissions({
        actual: assetPermissions,
        expected: graphPermissions,
      });
      if (missing.length === 0 && excess.length === 0) {
        return;
      }
      console.log(
        `[Sharing Panel] Managed asset ${asset.fileId.id}` +
        ` has ${missing.length} missing permission(s)` +
        ` and ${excess.length} excess permission(s). Synchronizing.`,
        {
          actual: assetPermissions,
          needed: graphPermissions,
          missing,
          excess,
        }
      );
      await Promise.all([
        ...missing.map((permission) =>
          googleDriveClient.createPermission(
            asset.fileId.id,
            { ...permission, role: "reader" },
            { sendNotificationEmail: false }
          )
        ),
        ...excess.map((permission) =>
          googleDriveClient.deletePermission(asset.fileId.id, permission.id!)
        ),
      ]);
    })
  );
}

async function checkUnmanagedAssetPermissionsAndMaybePromptTheUser(
  unmanagedAssets: GoogleDriveAsset[],
  graphPermissions: gapi.client.drive.Permission[]
): Promise<void> {
  if (unmanagedAssets.length === 0) {
    return;
  }
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;
  if (!googleDriveClient) {
    throw new Error(`No google drive client provided`);
  }
  const problems: UnmanagedAssetProblem[] = [];
  await Promise.all(
    unmanagedAssets.map(async (asset) => {
      const assetMetadata = await googleDriveClient.getFileMetadata(
        asset.fileId,
        {
          fields: [
            "id",
            "resourceKey",
            "name",
            "iconLink",
            "capabilities",
            "permissions",
          ],
          bypassProxy: true,
        }
      );
      if (
        !assetMetadata.capabilities.canShare ||
        !assetMetadata.permissions
      ) {
        problems.push({ asset: assetMetadata, problem: "cant-share" });
        return;
      }
      const { missing } = diffAssetReadPermissions({
        actual: assetMetadata.permissions,
        expected: graphPermissions,
      });
      if (missing.length > 0) {
        problems.push({ asset: assetMetadata, problem: "missing", missing });
        return;
      }
    })
  );
  if (problems.length === 0) {
    return;
  }
  // TODO(aomarks) Bump es level so we can get Promise.withResolvers.
  let closed: { promise: Promise<void>; resolve: () => void };
  {
    let resolve: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    closed = { promise, resolve: resolve! };
  }
  const oldState = share.state;
  share.state = {
    status: "unmanaged-assets",
    problems,
    oldState,
    closed,
  };
  // Since the unmanaged asset dialog shows up in a few different flows, it's
  // useful to make it so this function waits until it has been resolved.
  // TODO(aomarks) This is a kinda weird pattern. Think about a refactor.
  await closed.promise;
  share.state = oldState;
}

function getAssets(graph: GraphDescriptor | undefined): GoogleDriveAsset[] {
  if (!graph) {
    console.error("No graph");
    return [];
  }
  return findGoogleDriveAssetsInGraph(graph);
}

export async function publish(
  graph: GraphDescriptor | undefined,
  publishPermissions: gapi.client.drive.Permission[],
  shareSurface: string | undefined
): Promise<void> {
  console.log(`[Sharing Panel] Publishing`);
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;

  if (publishPermissions.length === 0) {
    console.error("No publish permissions configured");
    return;
  }
  if (share.state.status !== "writable") {
    console.error('Expected published status to be "writable"');
    return;
  }
  if (!googleDriveClient) {
    console.error(`No google drive client provided`);
    return;
  }

  if (share.state.published) {
    // Already published!
    return;
  }

  let { shareableFile } = share.state;
  const oldState = share.state;
  share.state = {
    status: "updating",
    published: true,
    granularlyShared: oldState.granularlyShared,
    shareableFile,
    userDomain: oldState.userDomain,
  };

  let newLatestVersion: string | undefined;
  if (!shareableFile) {
    const copyResult = await makeShareableCopy(graph, shareSurface);
    shareableFile = {
      id: copyResult.shareableCopyFileId,
      resourceKey: copyResult.shareableCopyResourceKey,
      stale: false,
      permissions: publishPermissions,
      shareSurface,
    };
    newLatestVersion = copyResult.newMainVersion;
  }

  const graphPublishPermissions = await Promise.all(
    publishPermissions.map((permission) =>
      googleDriveClient.createPermission(
        shareableFile.id,
        { ...permission, role: "reader" },
        { sendNotificationEmail: false }
      )
    )
  );

  console.debug(
    `[Sharing] Added ${publishPermissions.length} publish` +
    ` permission(s) to shareable graph copy "${shareableFile.id}".`
  );

  await handleAssetPermissions(shareableFile.id, graph);

  share.state = {
    status: "writable",
    published: true,
    publishedPermissions: graphPublishPermissions,
    granularlyShared: oldState.granularlyShared,
    shareableFile,
    latestVersion: newLatestVersion ?? oldState.latestVersion,
    userDomain: oldState.userDomain,
  };
}

export async function unpublish(
  graph: GraphDescriptor | undefined
): Promise<void> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;

  if (share.state.status !== "writable") {
    console.error('Expected published status to be "writable"');
    return;
  }
  if (!share.state.published) {
    // Already unpublished!
    return;
  }
  if (!googleDriveClient) {
    throw new Error(`No google drive client provided`);
  }
  const { shareableFile } = share.state;
  const oldState = share.state;
  share.state = {
    status: "updating",
    published: false,
    granularlyShared: oldState.granularlyShared,
    shareableFile,
    userDomain: share.state.userDomain,
  };

  console.debug(
    `[Sharing] Removing ${oldState.publishedPermissions.length} publish` +
    ` permission(s) from shareable graph copy "${shareableFile.id}".`
  );
  await Promise.all(
    oldState.publishedPermissions.map(async (permission) => {
      if (permission.role !== "owner") {
        await googleDriveClient.deletePermission(
          shareableFile.id,
          permission.id!
        );
      }
    })
  );

  await handleAssetPermissions(shareableFile.id, graph);

  share.state = {
    status: "writable",
    published: false,
    granularlyShared: oldState.granularlyShared,
    shareableFile,
    latestVersion: oldState.latestVersion,
    userDomain: oldState.userDomain,
  };
}

export async function publishStale(
  graph: GraphDescriptor | undefined
): Promise<void> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  const oldState = share.state;
  if (oldState.status !== "writable" || !oldState.shareableFile) {
    return;
  }
  if (!googleDriveClient) {
    throw new Error(`No google drive client provided`);
  }
  if (!boardServer) {
    throw new Error(`No board server provided`);
  }
  if (!(boardServer instanceof GoogleDriveBoardServer)) {
    throw new Error(`Provided board server was not Google Drive`);
  }
  if (!graph) {
    throw new Error(`No graph`);
  }

  share.state = {
    status: "updating",
    published: oldState.published,
    granularlyShared: oldState.granularlyShared,
    shareableFile: oldState.shareableFile,
    userDomain: oldState.userDomain,
  };

  const shareableFileUrl = new URL(`drive:/${oldState.shareableFile.id}`);
  const updatedShareableGraph = structuredClone(graph);
  delete updatedShareableGraph["url"];

  await Promise.all([
    // Update the contents of the shareable copy.
    boardServer.ops.writeGraphToDrive(
      shareableFileUrl,
      updatedShareableGraph
    ),
    // Update the latest version property on the main file.
    googleDriveClient.updateFileMetadata(oldState.shareableFile.id, {
      properties: {
        [DRIVE_PROPERTY_LATEST_SHARED_VERSION]: oldState.latestVersion,
      },
    }),
    // Ensure all assets have the same permissions as the shareable file,
    // since they might have been added since the last publish.
    handleAssetPermissions(oldState.shareableFile.id, graph),
  ]);

  share.state = {
    ...oldState,
    shareableFile: {
      ...oldState.shareableFile,
      stale: false,
    },
  };

  console.debug(
    `[Sharing] Updated stale shareable graph copy` +
    ` "${oldState.shareableFile.id}" to version` +
    ` "${oldState.latestVersion}".`
  );
}

export async function fixUnmanagedAssetProblems(): Promise<void> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;

  const state = share.state;
  if (state.status !== "unmanaged-assets") {
    return;
  }
  if (!googleDriveClient) {
    console.error(`No google drive client provided`);
    return;
  }
  share.state = { status: "loading" };
  await Promise.all(
    state.problems.map(async (problem) => {
      if (problem.problem === "missing") {
        await Promise.all(
          problem.missing.map((permission) =>
            googleDriveClient.createPermission(problem.asset.id, permission, {
              sendNotificationEmail: false,
            })
          )
        );
      }
    })
  );
  state.closed.resolve();
}

export function openPanel(): void {
  const { controller } = bind;
  controller.editor.share.state = { status: "opening" };
}

export function closePanel(): void {
  const { controller } = bind;
  controller.editor.share.state = { status: "closed" };
}

export async function viewSharePermissions(
  graph: GraphDescriptor | undefined,
  shareSurface: string | undefined
): Promise<void> {
  const { controller } = bind;
  const share = controller.editor.share;

  const oldState = share.state;
  if (oldState.status !== "writable") {
    return;
  }
  if (!graph?.url) {
    console.error(`No graph url`);
    return;
  }

  share.state = { status: "loading" };

  // We must create the shareable copy now if it doesn't already exist, since
  // that's the file we need to open the granular permissions dialog with.
  const shareableCopyFileId =
    oldState.shareableFile?.id ??
    (await makeShareableCopy(graph, shareSurface)).shareableCopyFileId;

  share.state = {
    status: "granular",
    shareableFile: { id: shareableCopyFileId },
  };
}

export async function onGoogleDriveSharePanelClose(
  graph: GraphDescriptor | undefined
): Promise<void> {
  const { controller } = bind;
  const share = controller.editor.share;

  if (share.state.status !== "granular") {
    return;
  }
  const graphFileId = share.state.shareableFile.id;
  share.state = { status: "loading" };
  await handleAssetPermissions(graphFileId, graph);
  share.state = { status: "opening" };
  openPanel();
}
