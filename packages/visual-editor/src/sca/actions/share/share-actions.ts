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
import type { DriveFileId } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { Utils } from "../../utils.js";
import { makeUrl } from "../../../ui/utils/urls.js";
import { makeShareLinkFromTemplate } from "../../../utils/make-share-link-from-template.js";
import { onGraphUrl } from "./triggers.js";

export const bind = makeAction();

const LABEL = "Share";

// =============================================================================
// Actions
// =============================================================================

/**
 * Resets share state and fetches fresh data from Drive. Triggered automatically
 * when a drive: graph URL is set (on initial board load and board swap).
 *
 * **Triggers:**
 * - `onGraphUrl`: Fires when graph URL is a drive: URL
 */
export const initialize = asAction(
  "Share.initialize",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onGraphUrl(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    share.reset();
    share.status = "initializing";
    await fetchShareData();
    share.status = "idle";
  }
);

/**
 * Fetches share data from Drive and populates the share controller fields.
 * Does not reset or manage status transitions — callers are responsible for
 * that.
 */
async function fetchShareData(): Promise<void> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  const graphUrl = getGraph()?.url;
  if (!graphUrl) {
    return;
  }
  const thisFileId = getGraphFileId(graphUrl);
  if (!thisFileId) {
    return;
  }

  // Technically these are global so don't need to be updated more than once
  // ever, but it's super cheap so it doesn't matter.
  share.userDomain = (await services.signinAdapter.domain) ?? "";
  share.publicPublishingAllowed = !(
    services.globalConfig.domains?.[share.userDomain]
      ?.disallowPublicPublishing ?? false
  );

  // Ensure the graph file has been fully created on Drive (board creation is
  // async — file ID is allocated instantly but the full write takes seconds).
  await boardServer.graphIsFullyCreated(graphUrl);

  // Ensure any pending changes are saved so that our Drive operations will be
  // synchronized with those changes.
  await boardServer.flushSaveQueue(graphUrl);

  const thisFileMetadata = await googleDriveClient.getFileMetadata(thisFileId, {
    fields: ["resourceKey", "properties", "ownedByMe", "version"],
    // Sometimes we are working on the featured gallery items themselves. In
    // that case, and for all such calls in this file, we should never use
    // the gallery proxy, because otherwise we will get responses that are
    // (1) potentially stale because of caching, (2) missing data because
    // we're not using the owning user's credentials (e.g. permissions get
    // masked out and appear empty).
    bypassProxy: true,
  });

  const thisFileIsAShareableCopy =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN] !==
    undefined;
  if (thisFileIsAShareableCopy) {
    share.ownership = "non-owner";
    share.shareableFile = {
      id: thisFileId,
      resourceKey: thisFileMetadata.resourceKey,
    };
    return;
  }

  const shareableCopyFileId =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY];

  if (!thisFileMetadata.ownedByMe) {
    share.ownership = "non-owner";
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
    share.ownership = "owner";
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

  share.ownership = "owner";
  share.published = diff.missing.length === 0;
  // We're granularly shared if there is any permission that is neither
  // one of the special publish permissions, nor the owner (since there
  // will always be an owner).
  share.granularlyShared =
    diff.excess.find((permission) => permission.role !== "owner") !== undefined;
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

/** Opens the share panel. */
export const open = asAction(
  "Share.open",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.panel !== "closed") {
      return;
    }
    share.panel = "open";
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

  /* c8 ignore start */
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
  /* c8 ignore end */
  return graphFileId;
}

function getRequiredPublishPermissions(): gapi.client.drive.Permission[] {
  const { services } = bind;
  const permissions = services.globalConfig.googleDrive?.publishPermissions;
  if (!permissions || permissions.length === 0) {
    /* c8 ignore start */
    Utils.Logging.getLogger().log(
      Utils.Logging.Formatter.error(
        "No googleDrive.publishPermissions configured"
      ),
      "Share.getRequiredPublishPermissions"
    );
    return [];
    /* c8 ignore end */
  }
  return permissions.map((permission) => ({ role: "reader", ...permission }));
}

// This computation must live in the actions layer because it needs access to
// guestConfig and globalConfig from services, but it can't be wrapped with
// "asAction" as required by the lint rule, because that forces it to be async.
// It can't be async because it needs to be rendered synchronously in the
// share panel.
// eslint-disable-next-line local-rules/action-exports-use-asaction
export function computeAppUrl(shareableFile: DriveFileId | null): string {
  if (!shareableFile) {
    return "";
  }
  const { services } = bind;
  const shareSurface = services.guestConfig.shareSurface;
  const shareSurfaceUrlTemplate =
    shareSurface &&
    services.guestConfig.shareSurfaceUrlTemplates?.[shareSurface];
  if (shareSurfaceUrlTemplate) {
    return makeShareLinkFromTemplate({
      urlTemplate: shareSurfaceUrlTemplate,
      fileId: shareableFile.id,
      resourceKey: shareableFile.resourceKey,
    });
  }
  const hostOrigin = services.globalConfig.hostOrigin;
  if (!hostOrigin) {
    return "";
  }
  return makeUrl(
    {
      page: "graph",
      mode: "app",
      flow: `drive:/${shareableFile.id}`,
      resourceKey: shareableFile.resourceKey,
      guestPrefixed: false,
    },
    hostOrigin
  );
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

  // Ensure the main file has been fully created on Drive before we try to
  // set properties on it or create a shareable copy from it.
  await boardServer.graphIsFullyCreated(graph.url);
  await boardServer.flushSaveQueue(graph.url);

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
    /* c8 ignore start */
    Utils.Logging.getLogger().log(
      Utils.Logging.Formatter.error("Unexpected create result", createResult),
      "Share.makeShareableCopy"
    );
    throw new Error(`Error creating shareable file`);
    /* c8 ignore end */
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
  await boardServer.graphIsFullyCreated(`drive:/${shareableCopyFileId}`);
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

  // Wait for the user to dismiss the unmanaged-assets dialog.
  // The share panel UI will render the asset-review view while
  // unmanagedAssetProblems.length > 0.
  await share.waitForUnmanagedAssetsResolution();
  // Problems are cleared after each publish attempt. If the user dismissed
  // without fixing, the same problems will be re-detected on the next
  // publish/publishStale call.
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
      /* c8 ignore start */
      logger.log(
        Utils.Logging.Formatter.error("No publish permissions configured"),
        LABEL
      );
      return;

      /* c8 ignore end */
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
    if (share.ownership !== "owner") {
      /* c8 ignore start */
      logger.log(
        Utils.Logging.Formatter.error('Expected ownership to be "owner"'),
        LABEL
      );
      return;

      /* c8 ignore end */
    }

    if (share.published) {
      // Already published!
      return;
    }

    share.status = "updating";
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
      /* c8 ignore start */
      logger.log(Utils.Logging.Formatter.error("No graph found"), LABEL);
      /* c8 ignore end */
    }

    share.status = "idle";
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
    if (share.ownership !== "owner") {
      /* c8 ignore start */
      logger.log(
        Utils.Logging.Formatter.error('Expected ownership to be "owner"'),
        LABEL
      );
      return;

      /* c8 ignore end */
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
    share.status = "updating";
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

    share.status = "idle";
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

    if (share.ownership !== "owner" || !share.shareableFile) {
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

    share.status = "updating";

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

    share.status = "idle";
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

    const problems = share.unmanagedAssetProblems;
    if (problems.length === 0) {
      return;
    }
    // Clear problems immediately to dismiss the asset-review view.
    // The underlying panel state ("updating" from publish) shows through,
    // providing loading feedback while permissions are being fixed.
    share.unmanagedAssetProblems = [];

    await Promise.all(
      problems.map(async (problem) => {
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

    if (share.unmanagedAssetProblems.length > 0) {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Cannot close panel while resolving unmanaged asset problems`
        ),
        "Share.closePanel"
      );
      return;
    }

    if (share.status === "updating") {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Cannot close panel while status is "updating"`
        ),
        "Share.closePanel"
      );
      return;
    }

    if (panel === "closed" || panel === "open") {
      share.panel = "closed";
    } else if (panel === "native-share") {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Cannot close panel while in "${panel}" state`
        ),
        "Share.closePanel"
      );
    } else {
      /* c8 ignore start */
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error(
          "Unhandled panel:",
          panel satisfies never
        ),
        "Share.closePanel"
      );

      /* c8 ignore end */
    }
  }
);

export const viewSharePermissions = asAction(
  "Share.viewSharePermissions",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.ownership !== "owner") {
      return;
    }

    // We must create the shareable copy now if it doesn't already exist, since
    // that's the file we need to open the native share permissions dialog with.
    let shareableCopyFileId = share.shareableFile?.id;
    if (!shareableCopyFileId) {
      share.status = "creating-shared-copy";
      shareableCopyFileId = (await makeShareableCopy()).shareableCopyFileId;
      share.status = "idle";
    }

    share.panel = "native-share";
    share.shareableFile = { id: shareableCopyFileId };
  }
);

export const onGoogleDriveSharePanelClose = asAction(
  "Share.onGoogleDriveSharePanelClose",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.panel !== "native-share" || !share.shareableFile) {
      return;
    }
    const graphFileId = share.shareableFile.id;
    share.panel = "open";
    share.status = "updating";
    const graph = getGraph();
    if (graph) {
      await handleAssetPermissions(graphFileId, graph);
    } else {
      /* c8 ignore start */
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error("No graph found"),
        "Share.onGoogleDriveSharePanelClose"
      );

      /* c8 ignore end */
    }
    // Re-sync share data to pick up any permission changes the user made.
    // TODO: Optimize — only permissions can change here, but fetchShareData
    // also re-fetches file metadata, flushes the save queue, etc. Factor out a
    // lightweight refreshPermissions() that just re-reads the shareable copy's
    // permissions and updates published/granularlyShared/publishedPermissions.
    await fetchShareData();
    share.status = "idle";
  }
);
