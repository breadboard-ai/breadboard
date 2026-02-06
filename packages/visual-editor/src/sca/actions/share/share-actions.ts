/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import {
  DRIVE_PROPERTY_IS_SHAREABLE_COPY,
  DRIVE_PROPERTY_LATEST_SHARED_VERSION,
  DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY,
  DRIVE_PROPERTY_OPAL_SHARE_SURFACE,
  DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN,
} from "@breadboard-ai/utils/google-drive/operations.js";
import {
  diffAssetReadPermissions,
  extractGoogleDriveFileId,
  findGoogleDriveAssetsInGraph,
  permissionMatchesAnyOf,
  type GoogleDriveAsset,
} from "@breadboard-ai/utils/google-drive/utils.js";
import type { UnmanagedAssetProblem } from "../../controller/subcontrollers/editor/share-controller.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";

export const bind = makeAction();

// =============================================================================
// Actions
// =============================================================================

export const readPublishedState = asAction(
  "Share.readPublishedState",
  { mode: ActionMode.Immediate },
  async (
    graph: GraphDescriptor,
    publishPermissions: gapi.client.drive.Permission[]
  ): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;
    const boardServer = services.googleDriveBoardServer;

    if (share.state.status !== "opening") {
      return;
    }

    const graphUrl = graph.url;
    if (!graphUrl) {
      console.error(`No graph url`);
      return;
    }
    const thisFileId = getGraphFileId(graphUrl);
    if (!thisFileId) {
      console.error(`No file id`);
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
);

// =============================================================================
// Internal Helpers
// =============================================================================

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

interface MakeShareableCopyResult {
  shareableCopyFileId: string;
  shareableCopyResourceKey: string | undefined;
  newMainVersion: string;
}

async function makeShareableCopy(
  graph: GraphDescriptor,
  shareSurface: string | undefined
): Promise<MakeShareableCopyResult> {
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

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

async function handleAssetPermissions(
  graphFileId: string,
  graph: GraphDescriptor
): Promise<void> {
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;

  const assets = findGoogleDriveAssetsInGraph(graph);
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

// =============================================================================
// Actions (continued)
// =============================================================================

export const publish = asAction(
  "Share.publish",
  { mode: ActionMode.Immediate },
  async (
    graph: GraphDescriptor,
    publishPermissions: gapi.client.drive.Permission[],
    shareSurface: string | undefined
  ): Promise<void> => {
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
);

export const unpublish = asAction(
  "Share.unpublish",
  { mode: ActionMode.Immediate },
  async (graph: GraphDescriptor): Promise<void> => {
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
);

export const publishStale = asAction(
  "Share.publishStale",
  { mode: ActionMode.Immediate },
  async (graph: GraphDescriptor): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;
    const boardServer = services.googleDriveBoardServer;

    const oldState = share.state;
    if (oldState.status !== "writable" || !oldState.shareableFile) {
      return;
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
);

export const fixUnmanagedAssetProblems = asAction(
  "Share.fixUnmanagedAssetProblems",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;

    const state = share.state;
    if (state.status !== "unmanaged-assets") {
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
);

export const openPanel = asAction(
  "Share.openPanel",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;
    if (share.state.status !== "closed") {
      return;
    }
    share.state = { status: "opening" };
  }
);

export const closePanel = asAction(
  "Share.closePanel",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;
    const state = share.state;
    const { status } = state;

    if (status === "closed" || status === "readonly" || status === "writable") {
      share.state = { status: "closed" };
    } else if (
      status === "opening" ||
      status === "loading" ||
      status === "updating" ||
      status === "granular" ||
      status === "unmanaged-assets"
    ) {
      console.warn(`[Sharing] Cannot close panel while in "${status}" state`);
    } else {
      console.error(`[Sharing] Unhandled state:`, state satisfies never);
    }
  }
);

export const viewSharePermissions = asAction(
  "Share.viewSharePermissions",
  { mode: ActionMode.Immediate },
  async (
    graph: GraphDescriptor,
    shareSurface: string | undefined
  ): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    const oldState = share.state;
    if (oldState.status !== "writable") {
      return;
    }
    if (!graph.url) {
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
);

export const onGoogleDriveSharePanelClose = asAction(
  "Share.onGoogleDriveSharePanelClose",
  { mode: ActionMode.Immediate },
  async (graph: GraphDescriptor): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.state.status !== "granular") {
      return;
    }
    const graphFileId = share.state.shareableFile.id;
    share.state = { status: "loading" };
    await handleAssetPermissions(graphFileId, graph);
    share.state = { status: "opening" };
    await openPanel();
  }
);
