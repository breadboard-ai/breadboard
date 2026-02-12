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

const LABEL = "Share";

// =============================================================================
// Actions
// =============================================================================

export const open = asAction(
  "Share.open",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller, services } = bind;

    const logger = Utils.Logging.getLogger(controller);
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;
    const boardServer = services.googleDriveBoardServer;

    if (share.panel !== "closed") {
      return;
    }

    const graphUrl = getGraph()?.url;
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

    share.userDomain = (await services.signinAdapter.domain) ?? "";
    share.publicPublishingAllowed = !(
      services.globalConfig.domains?.[share.userDomain]
        ?.disallowPublicPublishing ?? false
    );
    share.guestConfig = services.guestConfig;
    share.globalConfig = services.globalConfig;

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

      return;
    }

    if (!shareableCopyFileId) {
      share.panel = "writable";
      share.access = "writable";
      share.latestVersion = thisFileMetadata.version;
      return;
    }

    const shareableCopyFileMetadata = await googleDriveClient.getFileMetadata(
      shareableCopyFileId,
      {
        fields: ["resourceKey", "properties", "permissions"],
        bypassProxy: true,
      }
    );
    const publishPermissions = getRequiredPublishPermissions();
    const allGraphPermissions = shareableCopyFileMetadata.permissions ?? [];
    const diff = diffAssetReadPermissions({
      actual: allGraphPermissions,
      expected: publishPermissions,
    });

    share.panel = "writable";
    share.access = "writable";
    share.published = diff.missing.length === 0;
    // We're granularly shared if there is any permission that is neither
    // one of the special publish permissions, nor the owner (since there
    // will always be an owner).
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
    };
    share.latestVersion = thisFileMetadata.version;
  }
);

// =============================================================================
// Internal Helpers
// =============================================================================

function getGraph(): GraphDescriptor | null {
  const { controller } = bind;
  return controller.editor.graph.graph;
}

function getGraphFileId(graphUrl: string): string | undefined {
  const logger = Utils.Logging.getLogger();

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

function getRequiredPublishPermissions(): gapi.client.drive.Permission[] {
  const { services } = bind;
  const permissions = services.globalConfig.googleDrive?.publishPermissions;
  if (!permissions || permissions.length === 0) {
    Utils.Logging.getLogger().log(
      Utils.Logging.Formatter.error(
        "No googleDrive.publishPermissions configured"
      ),
      "Share.getRequiredPublishPermissions"
    );
    return [];
  }
  return permissions.map((permission) => ({ role: "reader", ...permission }));
}

interface MakeShareableCopyResult {
  shareableCopyFileId: string;
  shareableCopyResourceKey: string | undefined;
  newMainVersion: string;
}

async function makeShareableCopy(): Promise<MakeShareableCopyResult> {
  const { services } = bind;
  const graph = getGraph();
  if (!graph) {
    throw new Error(`No graph available`);
  }
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

  const shareSurface = services.guestConfig.shareSurface;
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
  async (): Promise<void> => {
    const { controller, services } = bind;

    const logger = Utils.Logging.getLogger(controller);
    logger.log(Utils.Logging.Formatter.verbose("Publishing"), LABEL);
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;

    const publishPermissions = getRequiredPublishPermissions();
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
    if (share.access !== "writable") {
      logger.log(
        Utils.Logging.Formatter.error(
          'Expected published status to be "writable"'
        ),
        LABEL
      );
      return;
    }

    if (share.published) {
      // Already published!
      return;
    }

    share.panel = "updating";
    share.published = true;

    let newLatestVersion: string | undefined;
    if (!share.shareableFile) {
      const copyResult = await makeShareableCopy();
      share.shareableFile = {
        id: copyResult.shareableCopyFileId,
        resourceKey: copyResult.shareableCopyResourceKey,
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

    const graph = getGraph();
    if (graph) {
      await handleAssetPermissions(share.shareableFile!.id, graph);
    } else {
      logger.log(Utils.Logging.Formatter.error("No graph found"), LABEL);
    }

    share.panel = "writable";
    share.published = true;
    share.publishedPermissions = graphPublishPermissions;
    share.latestVersion = newLatestVersion ?? share.latestVersion;
  }
);

export const unpublish = asAction(
  "Share.unpublish",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;

    const logger = Utils.Logging.getLogger(controller);
    if (share.access !== "writable") {
      logger.log(
        Utils.Logging.Formatter.error(
          'Expected published status to be "writable"'
        ),
        LABEL
      );
      return;
    }
    if (!share.published) {
      // Already unpublished!
      return;
    }
    const graph = getGraph();
    if (!graph) {
      logger.log(Utils.Logging.Formatter.error("No graph found"), LABEL);
      return;
    }
    share.panel = "updating";
    share.published = false;

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
  }
);

export const publishStale = asAction(
  "Share.publishStale",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;
    const boardServer = services.googleDriveBoardServer;

    if (share.access !== "writable" || !share.shareableFile) {
      return;
    }
    const graph = getGraph();
    if (!graph) {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error("No graph found"),
        "Share.publishStale"
      );
      return;
    }

    share.panel = "updating";

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

export const closePanel = asAction(
  "Share.closePanel",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;
    const panel = share.panel;

    if (panel === "closed" || panel === "readonly" || panel === "writable") {
      share.panel = "closed";
    } else if (
      panel === "loading" ||
      panel === "updating" ||
      panel === "granular" ||
      panel === "unmanaged-assets"
    ) {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Cannot close panel while in "${panel}" state`
        ),
        "Share.closePanel"
      );
    } else {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error(
          "Unhandled panel:",
          panel satisfies never
        ),
        "Share.closePanel"
      );
    }
  }
);

export const viewSharePermissions = asAction(
  "Share.viewSharePermissions",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.access !== "writable") {
      return;
    }

    share.panel = "loading";

    // We must create the shareable copy now if it doesn't already exist, since
    // that's the file we need to open the granular permissions dialog with.
    const shareableCopyFileId =
      share.shareableFile?.id ??
      (await makeShareableCopy()).shareableCopyFileId;

    share.panel = "granular";
    share.shareableFile = { id: shareableCopyFileId };
  }
);

export const onGoogleDriveSharePanelClose = asAction(
  "Share.onGoogleDriveSharePanelClose",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.panel !== "granular" || !share.shareableFile) {
      return;
    }
    const graphFileId = share.shareableFile.id;
    share.panel = "loading";
    const graph = getGraph();
    if (graph) {
      await handleAssetPermissions(graphFileId, graph);
    } else {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error("No graph found"),
        "Share.onGoogleDriveSharePanelClose"
      );
    }
    share.panel = "closed";
    await open();
  }
);
