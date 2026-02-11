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
import { Utils } from "../../utils.js";

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
    const LABEL = "Share.readPublishedState";
    const logger = Utils.Logging.getLogger(controller);
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;
    const boardServer = services.googleDriveBoardServer;

    if (share.panel !== "opening") {
      return;
    }

    const graphUrl = graph.url;
    if (!graphUrl) {
      logger.log(Utils.Logging.Formatter.error("No graph url"), LABEL);
      return;
    }
    const thisFileId = getGraphFileId(graphUrl);
    if (!thisFileId) {
      logger.log(Utils.Logging.Formatter.error("No file id"), LABEL);
      return;
    }

    share.panel = "loading";
    share.state = { status: "loading" };
    share.userDomain = (await services.signinAdapter.domain) ?? "";
    share.publicPublishingAllowed = !(
      services.globalConfig.domains?.[share.userDomain]
        ?.disallowPublicPublishing ?? false
    );

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
      share.panel = "readonly";
      share.access = "readonly";
      share.shareableFile = {
        id: thisFileId,
        resourceKey: thisFileMetadata.resourceKey,
      };
      share.state = {
        status: "readonly",
        shareableFile: share.shareableFile,
      };
      return;
    }

    const shareableCopyFileId =
      thisFileMetadata.properties?.[DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY];

    if (!thisFileMetadata.ownedByMe) {
      share.panel = "readonly";
      share.access = "readonly";
      share.shareableFile = shareableCopyFileId
        ? {
            id: shareableCopyFileId,
            resourceKey: (
              await googleDriveClient.getFileMetadata(shareableCopyFileId, {
                fields: ["resourceKey"],
                bypassProxy: true,
              })
            ).resourceKey,
          }
        : {
            id: thisFileId,
            resourceKey: thisFileMetadata.resourceKey,
          };
      share.state = {
        status: "readonly",
        shareableFile: share.shareableFile,
      };
      return;
    }

    if (!shareableCopyFileId) {
      share.panel = "writable";
      share.access = "writable";
      share.published = false;
      share.granularlyShared = false;
      share.latestVersion = thisFileMetadata.version;
      share.shareableFile = null;
      share.state = {
        status: "writable",
        published: false,
        granularlyShared: false,
        shareableFile: undefined,
        latestVersion: thisFileMetadata.version,
      };
      return;
    }

    const shareableCopyFileMetadata = await googleDriveClient.getFileMetadata(
      shareableCopyFileId,
      {
        fields: ["resourceKey", "properties", "permissions"],
        bypassProxy: true,
      }
    );
    const allGraphPermissions = shareableCopyFileMetadata.permissions ?? [];
    const diff = diffAssetReadPermissions({
      actual: allGraphPermissions,
      expected: publishPermissions,
    });

    share.panel = "writable";
    share.access = "writable";
    share.published = diff.missing.length === 0;
    share.granularlyShared =
      diff.excess.find((permission) => permission.role !== "owner") !==
      undefined;
    share.stale =
      thisFileMetadata.version !==
      shareableCopyFileMetadata.properties?.[
        DRIVE_PROPERTY_LATEST_SHARED_VERSION
      ];
    share.publishedPermissions = allGraphPermissions.filter((permission) =>
      permissionMatchesAnyOf(permission, publishPermissions)
    );
    share.shareableFile = {
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
    };
    share.state = {
      status: "writable",
      published: diff.missing.length === 0,
      publishedPermissions: share.publishedPermissions,
      granularlyShared:
        // We're granularly shared if there is any permission that is neither
        // one of the special publish permissions, nor the owner (since there
        // will always an owner).
        diff.excess.find((permission) => permission.role !== "owner") !==
        undefined,
      shareableFile: share.shareableFile as any,
      latestVersion: thisFileMetadata.version,
    };
    share.latestVersion = thisFileMetadata.version;

    logger.log(
      Utils.Logging.Formatter.verbose(
        "Found sharing state:",
        JSON.stringify(share.state, null, 2)
      ),
      LABEL
    );
  }
);

// =============================================================================
// Internal Helpers
// =============================================================================

function getGraphFileId(graphUrl: string): string | undefined {
  const logger = Utils.Logging.getLogger();
  const LABEL = "Share.getGraphFileId";
  if (!graphUrl.startsWith("drive:")) {
    logger.log(
      Utils.Logging.Formatter.error(
        `Expected "drive:" prefixed graph URL, got ${JSON.stringify(graphUrl)}`
      ),
      LABEL
    );
    return undefined;
  }
  const graphFileId = graphUrl.replace(/^drive:\/*/, "");
  if (!graphFileId) {
    logger.log(Utils.Logging.Formatter.error("Graph file ID was empty"), LABEL);
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
  const shareableCopyFileId = extractGoogleDriveFileId(createResult.url ?? "");
  if (!shareableCopyFileId) {
    Utils.Logging.getLogger().log(
      Utils.Logging.Formatter.error("Unexpected create result", createResult),
      "Share.makeShareableCopy"
    );
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

  const shareableCopyMetadata = await googleDriveClient.updateFileMetadata(
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

  Utils.Logging.getLogger().log(
    Utils.Logging.Formatter.verbose(
      `Made a new shareable graph copy "${shareableCopyFileId}"` +
        ` at version "${updateMainResult.version}".`
    ),
    "Share.makeShareableCopy"
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
        Utils.Logging.getLogger().log(
          Utils.Logging.Formatter.error(
            `Could not add permission to asset ` +
              `"${asset.fileId.id}" because the current user does not have` +
              ` sharing capability on it. Users who don't already have` +
              ` access to this asset may not be able to run this graph.`
          ),
          "Share.autoSyncManagedAssetPermissions"
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
      Utils.Logging.getLogger().log(
        Utils.Logging.Formatter.verbose(
          `Managed asset ${asset.fileId.id}` +
            ` has ${missing.length} missing permission(s)` +
            ` and ${excess.length} excess permission(s). Synchronizing.`,
          {
            actual: assetPermissions,
            needed: graphPermissions,
            missing,
            excess,
          }
        ),
        "Share.autoSyncManagedAssetPermissions"
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
      if (!assetMetadata.capabilities.canShare || !assetMetadata.permissions) {
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
  share.unmanagedAssetProblems = problems;
  const previousPanel = share.panel;
  share.panel = "unmanaged-assets";
  share.state = {
    status: "unmanaged-assets",
    problems,
    oldState: share.state,
    closed: {
      promise: Promise.resolve(),
      resolve: () => {},
    },
  };
  // Wait for the user to dismiss the unmanaged-assets dialog.
  await share.waitForUnmanagedAssetsResolution();
  share.panel = previousPanel;
  share.unmanagedAssetProblems = [];
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
    const { controller, services } = bind;
    const LABEL = "Share.publish";
    const logger = Utils.Logging.getLogger(controller);
    logger.log(Utils.Logging.Formatter.verbose("Publishing"), LABEL);
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;

    if (publishPermissions.length === 0) {
      logger.log(
        Utils.Logging.Formatter.error("No publish permissions configured"),
        LABEL
      );
      return;
    }
    if (!share.publicPublishingAllowed) {
      logger.log(
        Utils.Logging.Formatter.error(
          "Public publishing is disallowed for this domain"
        ),
        LABEL
      );
      return;
    }
    if (share.state.status !== "writable") {
      logger.log(
        Utils.Logging.Formatter.error(
          'Expected published status to be "writable"'
        ),
        LABEL
      );
      return;
    }

    if (share.state.published) {
      // Already published!
      return;
    }

    const oldState = share.state;
    share.panel = "updating";
    share.published = true;
    share.state = {
      status: "updating",
      published: true,
      granularlyShared: oldState.granularlyShared,
      shareableFile: share.shareableFile as any,
    };

    let newLatestVersion: string | undefined;
    if (!share.shareableFile) {
      const copyResult = await makeShareableCopy(graph, shareSurface);
      share.shareableFile = {
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
          share.shareableFile!.id,
          { ...permission, role: "reader" },
          { sendNotificationEmail: false }
        )
      )
    );

    logger.log(
      Utils.Logging.Formatter.verbose(
        `Added ${publishPermissions.length} publish` +
          ` permission(s) to shareable graph copy "${share.shareableFile!.id}".`
      ),
      LABEL
    );

    await handleAssetPermissions(share.shareableFile!.id, graph);

    share.panel = "writable";
    share.published = true;
    share.state = {
      status: "writable",
      published: true,
      publishedPermissions: graphPublishPermissions,
      granularlyShared: oldState.granularlyShared,
      shareableFile: share.shareableFile as any,
      latestVersion: newLatestVersion ?? oldState.latestVersion,
    };
    share.publishedPermissions = graphPublishPermissions;
    share.latestVersion = newLatestVersion ?? oldState.latestVersion;
  }
);

export const unpublish = asAction(
  "Share.unpublish",
  { mode: ActionMode.Immediate },
  async (graph: GraphDescriptor): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;

    const LABEL = "Share.unpublish";
    const logger = Utils.Logging.getLogger(controller);
    if (share.state.status !== "writable") {
      logger.log(
        Utils.Logging.Formatter.error(
          'Expected published status to be "writable"'
        ),
        LABEL
      );
      return;
    }
    if (!share.state.published) {
      // Already unpublished!
      return;
    }
    const oldState = share.state;
    share.panel = "updating";
    share.published = false;
    share.state = {
      status: "updating",
      published: false,
      granularlyShared: oldState.granularlyShared,
      shareableFile: share.shareableFile as any,
    };

    logger.log(
      Utils.Logging.Formatter.verbose(
        `Removing ${share.publishedPermissions.length} publish` +
          ` permission(s) from shareable graph copy "${share.shareableFile!.id}".`
      ),
      LABEL
    );
    await Promise.all(
      share.publishedPermissions.map(async (permission) => {
        if (permission.role !== "owner") {
          await googleDriveClient.deletePermission(
            share.shareableFile!.id,
            permission.id!
          );
        }
      })
    );

    await handleAssetPermissions(share.shareableFile!.id, graph);

    share.panel = "writable";
    share.published = false;
    share.state = {
      status: "writable",
      published: false,
      granularlyShared: oldState.granularlyShared,
      shareableFile: share.shareableFile as any,
      latestVersion: oldState.latestVersion,
    };
    share.latestVersion = oldState.latestVersion;
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
    if (oldState.status !== "writable" || !share.shareableFile) {
      return;
    }

    share.panel = "updating";
    share.published = oldState.published;
    share.granularlyShared = oldState.granularlyShared;
    share.state = {
      status: "updating",
      published: oldState.published,
      granularlyShared: oldState.granularlyShared,
      shareableFile: share.shareableFile as any,
    };

    const shareableFileUrl = new URL(`drive:/${share.shareableFile.id}`);
    const updatedShareableGraph = structuredClone(graph);
    delete updatedShareableGraph["url"];

    await Promise.all([
      // Update the contents of the shareable copy.
      boardServer.ops.writeGraphToDrive(
        shareableFileUrl,
        updatedShareableGraph
      ),
      // Update the latest version property on the main file.
      googleDriveClient.updateFileMetadata(share.shareableFile.id, {
        properties: {
          [DRIVE_PROPERTY_LATEST_SHARED_VERSION]: share.latestVersion,
        },
      }),
      // Ensure all assets have the same permissions as the shareable file,
      // since they might have been added since the last publish.
      handleAssetPermissions(share.shareableFile.id, graph),
    ]);

    share.panel = "writable";
    share.stale = false;
    share.shareableFile = { ...share.shareableFile, stale: false };
    share.state = {
      ...oldState,
      shareableFile: share.shareableFile as any,
    };

    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Updated stale shareable graph copy` +
          ` "${share.shareableFile!.id}" to version` +
          ` "${share.latestVersion}".`
      ),
      "Share.publishStale"
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

    if (share.unmanagedAssetProblems.length === 0) {
      return;
    }
    share.panel = "loading";
    share.state = { status: "loading" };
    await Promise.all(
      share.unmanagedAssetProblems.map(async (problem) => {
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
    share.resolveUnmanagedAssets();
  }
);

export const dismissUnmanagedAssetProblems = asAction(
  "Share.dismissUnmanagedAssetProblems",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;
    share.resolveUnmanagedAssets();
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
    share.panel = "opening";
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
      share.panel = "closed";
      share.state = { status: "closed" };
    } else if (
      status === "opening" ||
      status === "loading" ||
      status === "updating" ||
      status === "granular" ||
      status === "unmanaged-assets"
    ) {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Cannot close panel while in "${status}" state`
        ),
        "Share.closePanel"
      );
    } else {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error(
          "Unhandled state:",
          state satisfies never
        ),
        "Share.closePanel"
      );
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
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error("No graph url"),
        "Share.viewSharePermissions"
      );
      return;
    }

    share.panel = "loading";
    share.state = { status: "loading" };

    // We must create the shareable copy now if it doesn't already exist, since
    // that's the file we need to open the granular permissions dialog with.
    const shareableCopyFileId =
      share.shareableFile?.id ??
      (await makeShareableCopy(graph, shareSurface)).shareableCopyFileId;

    share.panel = "granular";
    share.shareableFile = { id: shareableCopyFileId };
    share.state = {
      status: "granular",
      shareableFile: share.shareableFile,
    };
  }
);

export const onGoogleDriveSharePanelClose = asAction(
  "Share.onGoogleDriveSharePanelClose",
  { mode: ActionMode.Immediate },
  async (graph: GraphDescriptor): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.state.status !== "granular" || !share.shareableFile) {
      return;
    }
    const graphFileId = share.shareableFile.id;
    share.panel = "loading";
    share.state = { status: "loading" };
    await handleAssetPermissions(graphFileId, graph);
    share.panel = "opening";
    share.state = { status: "opening" };
    await openPanel();
  }
);
