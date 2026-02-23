/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { ToastType } from "../../types.js";
import {
  DRIVE_PROPERTY_IS_SHAREABLE_COPY,
  DRIVE_PROPERTY_LATEST_SHARED_VERSION,
  DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY,
  DRIVE_PROPERTY_OPAL_SHARE_SURFACE,
  DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN,
  DRIVE_PROPERTY_VIEWER_MODE,
} from "@breadboard-ai/utils/google-drive/operations.js";
import {
  diffPermissionsIgnoringRole,
  extractGoogleDriveFileId,
  findGoogleDriveAssetsInGraph,
  permissionMatchesAnyOfIgnoringRole,
  type GoogleDriveAsset,
} from "@breadboard-ai/utils/google-drive/utils.js";
import {
  findNotebookAssetsInGraph,
  type NotebookAsset,
} from "@breadboard-ai/utils";
import type {
  UnmanagedAssetProblem,
  ViewerMode,
  VisibilityLevel,
} from "../../controller/subcontrollers/editor/share-controller.js";
import type { DriveFileId } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import {
  NotebookAccessRole,
  type NotebookPermission,
} from "../../services/notebooklm-api-client.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { Utils } from "../../utils.js";
import { makeUrl, parseUrl } from "../../../ui/navigation/urls.js";
import { makeShareLinkFromTemplate } from "../../../utils/make-share-link-from-template.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../../ui/config/client-deployment-configuration.js";
import { onGraphUrl, onSaveComplete } from "./triggers.js";
import { SaveCompleteEvent } from "../../../board-server/events.js";

export const bind = makeAction();

const LABEL = "Share";

const GENERIC_ERROR_MESSAGE =
  "Something went wrong while sharing. Please reload and try again.";

type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

function ok(): Result;
function ok<T>(value: T): Result<T>;
function ok<T>(value?: T): Result<T> {
  return { ok: true, value: value as T };
}

function err(error: string): Result<never> {
  return { ok: false, error };
}

function findErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultify<T>(fn: () => Promise<T>): Promise<Result<T>>;
function resultify<T>(fn: () => T): Result<T>;
function resultify<T>(
  fn: () => T | Promise<T>
): Result<T> | Promise<Result<T>> {
  try {
    const value = fn();
    if (value instanceof Promise) {
      return value.then(
        (value): Result<T> => ok(value),
        (error): Result<T> => err(findErrorMessage(error))
      );
    }
    return ok(value);
  } catch (error) {
    return err(findErrorMessage(error));
  }
}

function handleFatalShareError(
  result: Result<unknown>
): result is { ok: false; error: string } {
  if (result.ok) {
    return false;
  }
  Utils.Logging.getLogger().log(
    Utils.Logging.Formatter.error(result.error),
    LABEL
  );
  const { controller } = bind;
  const share = controller.editor.share;
  share.error = GENERIC_ERROR_MESSAGE;
  controller.global.toasts.toast(GENERIC_ERROR_MESSAGE, ToastType.ERROR);
  return true;
}

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
    if (handleFatalShareError(await fetchShareData())) {
      return;
    }

    // Enforce app-only access: if a non-owner lands on an edit URL for an opal
    // with viewerMode="app-only", redirect them to the app URL.
    //
    // TODO(aomarks) I'm not sure this is the right place for this. Feels potentially
    // like a router-level concern. But, it does depend on reading sharing metadata
    // from drive.
    if (
      share.ownership === "non-owner" &&
      share.viewerMode === "app-only" &&
      typeof window !== "undefined" &&
      window.location
    ) {
      const current = parseUrl(window.location.href);
      if (current.page === "graph" && current.mode === "canvas") {
        const appUrl = makeUrl({ ...current, mode: "app" });
        window.history.replaceState(null, "", appUrl);
        controller.router.updateFromCurrentUrl();
      }
    }

    share.status = "ready";
  }
);

/**
 * Updates the editable version when a graph is saved to Google Drive.
 */
export const updateEditableVersion = asAction(
  "Share.updateEditableVersion",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onSaveComplete(bind),
  },
  async (evt?: Event): Promise<void> => {
    const event = evt as SaveCompleteEvent | undefined;
    if (!event) return;

    const { controller } = bind;
    const share = controller.editor.share;
    const currentUrl = controller.editor.graph.url;

    // Only update if this event is for the currently open graph.
    if (!currentUrl || currentUrl !== event.url) {
      return;
    }

    share.editableVersion = event.version;
  }
);

/**
 * Fetches share data from Drive and populates the share controller fields.
 * Does not reset or manage status transitions — callers are responsible for
 * that.
 */
async function fetchShareData(): Promise<Result> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  const graphUrl = getGraph()?.url;
  if (!graphUrl) {
    /* c8 ignore next */
    return err("No graph URL");
  }
  const thisFileId = getGraphFileId(graphUrl);
  if (!thisFileId) {
    /* c8 ignore next */
    return err("No graph file ID");
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

  const thisFileMetadataResult = await resultify(() =>
    googleDriveClient.getFileMetadata(thisFileId, {
      fields: ["resourceKey", "properties", "ownedByMe", "version"],
      // Sometimes we are working on the featured gallery items themselves. In
      // that case, and for all such calls in this file, we should never use
      // the gallery proxy, because otherwise we will get responses that are
      // (1) potentially stale because of caching, (2) missing data because
      // we're not using the owning user's credentials (e.g. permissions get
      // masked out and appear empty).
      bypassProxy: true,
    })
  );
  if (!thisFileMetadataResult.ok) {
    return thisFileMetadataResult;
  }

  const thisFileMetadata = thisFileMetadataResult.value;
  const thisFileIsAShareableCopy =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN] !==
    undefined;
  if (thisFileIsAShareableCopy) {
    share.ownership = "non-owner";
    share.shareableFile = {
      id: thisFileId,
      resourceKey: thisFileMetadata.resourceKey,
    };
    share.viewerMode = readViewerModeProperty(thisFileMetadata.properties);
    return ok();
  }

  const shareableCopyFileId =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY];

  if (!thisFileMetadata.ownedByMe) {
    share.ownership = "non-owner";
    if (shareableCopyFileId) {
      const copyMeta = await resultify(() =>
        googleDriveClient.getFileMetadata(shareableCopyFileId, {
          fields: ["resourceKey", "properties"],
          bypassProxy: true,
        })
      );
      if (!copyMeta.ok) {
        return copyMeta;
      }
      share.shareableFile = {
        id: shareableCopyFileId,
        resourceKey: copyMeta.value.resourceKey,
      };
      share.viewerMode = readViewerModeProperty(copyMeta.value.properties);
    } else {
      share.shareableFile = {
        id: thisFileId,
        resourceKey: thisFileMetadata.resourceKey,
      };
    }
    return ok();
  }

  if (!shareableCopyFileId) {
    share.ownership = "owner";
    share.editableVersion = thisFileMetadata.version;
    return ok();
  }

  const shareableCopyMetaResult = await resultify(() =>
    googleDriveClient.getFileMetadata(shareableCopyFileId, {
      fields: ["resourceKey", "properties", "permissions", "modifiedTime"],
      bypassProxy: true,
    })
  );
  if (!shareableCopyMetaResult.ok) {
    return shareableCopyMetaResult;
  }

  const shareableCopyMeta = shareableCopyMetaResult.value;
  const actualPermissions = shareableCopyMeta.permissions ?? [];

  share.ownership = "owner";
  updateControllerPermissionState(actualPermissions);
  share.editableVersion = thisFileMetadata.version;
  share.sharedVersion =
    shareableCopyMeta.properties?.[DRIVE_PROPERTY_LATEST_SHARED_VERSION] ?? "";
  share.shareableFile = {
    id: shareableCopyFileId,
    resourceKey: shareableCopyMeta.resourceKey,
  };
  share.viewerMode = readViewerModeProperty(shareableCopyMeta.properties);
  share.lastPublishedIso = shareableCopyMeta.modifiedTime ?? "";
  return ok();
}

/** Opens the share panel. */
export const open = asAction(
  "Share.open",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

    if (share.panel !== "closed") {
      /* c8 ignore start */
      return;
      /* c8 ignore end */
    }
    share.panel = "open";

    // When SHARING_2 is off, always re-sync on open to match legacy behavior.
    if (!CLIENT_DEPLOYMENT_CONFIG.ENABLE_SHARING_2) {
      share.status = "initializing";
      if (handleFatalShareError(await fetchShareData())) {
        return;
      }
      share.status = "ready";
    }
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
    /* c8 ignore start */
    logger.log(
      Utils.Logging.Formatter.error(
        `Expected "drive:" prefixed graph URL, got ${JSON.stringify(graphUrl)}`
      ),
      LABEL
    );
    return undefined;
    /* c8 ignore end */
  }
  const graphFileId = graphUrl.replace(/^drive:\/*/, "");
  if (!graphFileId) {
    /* c8 ignore start */
    logger.log(Utils.Logging.Formatter.error("Graph file ID was empty"), LABEL);
    /* c8 ignore end */
  }
  return graphFileId;
}

function getConfiguredPublishPermissions(): gapi.client.drive.Permission[] {
  const { services } = bind;
  const permissions = services.globalConfig.googleDrive?.publishPermissions;
  if (!permissions || permissions.length === 0) {
    /* c8 ignore start */
    Utils.Logging.getLogger().log(
      Utils.Logging.Formatter.error(
        "No googleDrive.publishPermissions configured"
      ),
      "Share.getConfiguredPublishPermissions"
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
  /**
   * The Drive version of the main file after writing the shareable-copy link
   * metadata. Stored as sharedVersion so the stale getter doesn't treat the
   * metadata-only version bump as a content change.
   */
  newMainVersion: string;
  /** ISO 8601 timestamp of when the shareable copy was last modified. */
  modifiedTime: string;
}

/**
 * Ensures a shareable copy exists, creating one if necessary.
 * Sets share.shareableFile on the controller and returns the file ID.
 */
async function ensureShareableCopyExists(): Promise<Result<string>> {
  const { controller } = bind;
  const share = controller.editor.share;
  if (!share.shareableFile) {
    const result = await makeShareableCopy();
    if (!result.ok) {
      return result;
    }
    share.shareableFile = {
      id: result.value.shareableCopyFileId,
      resourceKey: result.value.shareableCopyResourceKey,
    };
    share.editableVersion = result.value.newMainVersion;
    share.sharedVersion = result.value.newMainVersion;
    share.lastPublishedIso = result.value.modifiedTime;
  }
  return ok(share.shareableFile.id);
}

/**
 * Derives and sets the permission-related controller fields from the actual
 * permissions currently on the shareable copy.
 */
function updateControllerPermissionState(
  actualPermissions: gapi.client.drive.Permission[]
): void {
  const { controller } = bind;
  const share = controller.editor.share;
  const publishPermissions = getConfiguredPublishPermissions();
  const diff = diffPermissionsIgnoringRole({
    actual: actualPermissions,
    expected: publishPermissions,
  });
  share.hasPublicPermissions = diff.missing.length === 0;
  share.hasOtherPermissions =
    diff.excess.find((p) => p.role !== "owner") !== undefined;
  share.actualPermissions = actualPermissions.filter((p) =>
    permissionMatchesAnyOfIgnoringRole(p, publishPermissions)
  );
}

/**
 * Diffs actual vs desired permissions on a file and applies the changes
 * (deleting excess, creating missing).
 */
async function applyPermissionDiff(
  fileId: string,
  actual: gapi.client.drive.Permission[],
  desired: gapi.client.drive.Permission[]
): Promise<Result<gapi.client.drive.Permission[]>> {
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;
  const logger = Utils.Logging.getLogger();
  const { missing, excess } = diffPermissionsIgnoringRole({
    actual,
    expected: desired,
  });
  if (excess.length === 0 && missing.length === 0) {
    return ok(actual);
  }

  const deleteResults = await Promise.all(
    excess
      .filter((p) => p.id)
      .map((p) =>
        resultify(() => googleDriveClient.deletePermission(fileId, p.id!))
      )
  );
  for (const r of deleteResults) {
    if (!r.ok) {
      return r;
    }
  }

  const createResults = await Promise.all(
    missing.map((p) =>
      resultify(() =>
        googleDriveClient.createPermission(
          fileId,
          { ...p, role: "reader" },
          { sendNotificationEmail: false }
        )
      )
    )
  );
  const created: gapi.client.drive.Permission[] = [];
  for (const r of createResults) {
    if (!r.ok) {
      return r;
    }
    created.push(r.value);
  }

  logger.log(
    Utils.Logging.Formatter.verbose(
      `Permissions on "${fileId}":` +
        ` removed ${excess.length}, added ${missing.length}.`
    ),
    LABEL
  );
  // Return the resulting permissions: actual minus excess plus created.
  const deletedIds = new Set(excess.map((p) => p.id));
  return {
    ok: true,
    value: [...actual.filter((p) => !deletedIds.has(p.id)), ...created],
  };
}

async function makeShareableCopy(): Promise<Result<MakeShareableCopyResult>> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const graph = getGraph();
  if (!graph) {
    /* c8 ignore start */
    throw new Error(`No graph available`);
    /* c8 ignore end */
  }
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  if (!graph.url) {
    /* c8 ignore start */
    throw new Error(`Graph had no URL`);
    /* c8 ignore end */
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

  const createResult = await resultify(() =>
    boardServer.create(
      // Oddly, the title of the file is extracted from a URL that is passed in,
      // even though URLs of this form are otherwise totally invalid.
      //
      // TODO(aomarks) This doesn't seem to actually work. The title is in fact
      // taken from the descriptor. So what is the purpose of passing a URL
      // here?
      new URL(`drive:/${shareableFileName}`),
      shareableGraph
    )
  );
  if (!createResult.ok) {
    return createResult;
  }
  const shareableCopyFileId = extractGoogleDriveFileId(
    createResult.value.url ?? ""
  );
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
  const updateMainResult = await resultify(() =>
    googleDriveClient.updateFileMetadata(
      mainFileId,
      {
        properties: {
          [DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY]: shareableCopyFileId,
        },
      },
      { fields: ["version"] }
    )
  );
  if (!updateMainResult.ok) {
    return updateMainResult;
  }

  // Ensure the creation of the copy has fully completed.
  //
  // TODO(aomarks) Move more sharing logic into board server so that this
  // create/update coordination doesn't need to be a concern of this
  // component.
  await boardServer.graphIsFullyCreated(`drive:/${shareableCopyFileId}`);
  await boardServer.flushSaveQueue(`drive:/${shareableCopyFileId}`);

  const shareSurface = services.guestConfig.shareSurface;
  const copyMetaResult = await resultify(() =>
    googleDriveClient.updateFileMetadata(
      shareableCopyFileId,
      {
        properties: {
          [DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN]: mainFileId,
          [DRIVE_PROPERTY_LATEST_SHARED_VERSION]:
            updateMainResult.value.version,
          [DRIVE_PROPERTY_IS_SHAREABLE_COPY]: "true",
          ...(shareSurface
            ? { [DRIVE_PROPERTY_OPAL_SHARE_SURFACE]: shareSurface }
            : {}),
          ...writeViewerModeProperty(share.viewerMode),
        },
      },
      { fields: ["resourceKey", "modifiedTime"] }
    )
  );
  if (!copyMetaResult.ok) {
    return copyMetaResult;
  }

  Utils.Logging.getLogger().log(
    Utils.Logging.Formatter.verbose(
      `Made a new shareable graph copy "${shareableCopyFileId}"` +
        ` at version "${updateMainResult.value.version}".`
    ),
    "Share.makeShareableCopy"
  );
  return {
    ok: true,
    value: {
      shareableCopyFileId,
      shareableCopyResourceKey: copyMetaResult.value.resourceKey,
      newMainVersion: updateMainResult.value.version,
      modifiedTime: copyMetaResult.value.modifiedTime ?? "",
    },
  };
}

async function handleAssetPermissions(
  graphFileId: string,
  graph: GraphDescriptor
): Promise<Result> {
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;

  const driveAssets = findGoogleDriveAssetsInGraph(graph);
  const notebookAssets = findNotebookAssetsInGraph(graph);

  if (driveAssets.length === 0 && notebookAssets.length === 0) {
    return ok();
  }

  const managedDriveAssets: GoogleDriveAsset[] = [];
  const unmanagedDriveAssets: GoogleDriveAsset[] = [];
  for (const asset of driveAssets) {
    if (asset.managed) {
      managedDriveAssets.push(asset);
    } else {
      unmanagedDriveAssets.push(asset);
    }
  }

  const graphPermsMeta = await resultify(() =>
    googleDriveClient.getFileMetadata(graphFileId, {
      fields: ["permissions"],
      bypassProxy: true,
    })
  );
  if (!graphPermsMeta.ok) {
    return graphPermsMeta;
  }

  const graphPermissions = graphPermsMeta.value.permissions ?? [];
  const notebookPermissions =
    drivePermissionsToNotebookPermissions(graphPermissions);

  await Promise.all([
    autoSyncManagedAssetPermissions(managedDriveAssets, graphPermissions),
    checkUnmanagedAssetPermissionsAndMaybePromptTheUser(
      unmanagedDriveAssets,
      graphPermissions,
      notebookAssets,
      notebookPermissions
    ),
  ]);
  return ok();
}

/**
 * Converts Drive permissions to NotebookLM permissions. Only user/group
 * permissions with email addresses can be mapped; domain-wide and "anyone"
 * permissions are not supported by the NotebookLM API and are skipped.
 */
function drivePermissionsToNotebookPermissions(
  drivePermissions: gapi.client.drive.Permission[]
): NotebookPermission[] {
  const permissions: NotebookPermission[] = [];
  for (const p of drivePermissions) {
    if (
      (p.type === "user" || p.type === "group") &&
      p.emailAddress &&
      p.role !== "owner"
    ) {
      permissions.push({
        email: p.emailAddress,
        accessRole: NotebookAccessRole.VIEWER,
      });
    }
  }
  return permissions;
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
      const metaResult = await resultify(() =>
        googleDriveClient.getFileMetadata(asset.fileId, {
          fields: ["capabilities", "permissions"],
          bypassProxy: true,
        })
      );
      if (!metaResult.ok) {
        return;
      }
      const { capabilities, permissions: assetPermissions } = metaResult.value;
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
      await applyPermissionDiff(
        asset.fileId.id,
        assetPermissions,
        graphPermissions
      );
    })
  );
}

async function checkUnmanagedAssetPermissionsAndMaybePromptTheUser(
  unmanagedAssets: GoogleDriveAsset[],
  graphPermissions: gapi.client.drive.Permission[],
  unmanagedNotebooks: NotebookAsset[],
  notebookPermissions: NotebookPermission[]
): Promise<void> {
  if (unmanagedAssets.length === 0 && unmanagedNotebooks.length === 0) {
    return;
  }
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;
  const nlmClient = services.notebookLmApiClient;
  const problems: UnmanagedAssetProblem[] = [];

  // Check Drive assets
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
        problems.push({
          type: "drive",
          asset: assetMetadata,
          problem: "cant-share",
        });
        return;
      }
      const { missing } = diffPermissionsIgnoringRole({
        actual: assetMetadata.permissions,
        expected: graphPermissions,
      });
      if (missing.length > 0) {
        problems.push({
          type: "drive",
          asset: assetMetadata,
          problem: "missing",
          missing,
        });
        return;
      }
    })
  );

  // Check Notebook assets
  if (notebookPermissions.length > 0) {
    await Promise.all(
      unmanagedNotebooks.map(async (notebook) => {
        try {
          const existing = await nlmClient.listNotebookPermissions({
            parent: `notebooks/${notebook.notebookId}`,
          });
          const existingEmails = new Set(
            (existing.permissions ?? []).flatMap((p) =>
              "email" in p ? [p.email] : []
            )
          );
          const missingEmails = notebookPermissions
            .filter((p) => "email" in p && !existingEmails.has(p.email))
            .map((p) => (p as { email: string }).email);
          if (missingEmails.length > 0) {
            // Get the notebook name for display
            let notebookName = notebook.notebookId;
            try {
              const nb = await nlmClient.getNotebook({
                name: `notebooks/${notebook.notebookId}`,
              });
              notebookName = nb.displayName ?? notebookName;
            } catch {
              // Use ID as fallback name
            }
            problems.push({
              type: "notebook",
              notebookId: notebook.notebookId,
              notebookName,
              problem: "missing",
              missingEmails,
            });
          }
        } catch {
          // If we can't list permissions, treat as cant-share
          problems.push({
            type: "notebook",
            notebookId: notebook.notebookId,
            notebookName: notebook.notebookId,
            problem: "cant-share",
          });
        }
      })
    );
  }

  // Flag if there are domain/anyone permissions that can't be applied to
  // notebooks (independent of individual permission problems).
  if (unmanagedNotebooks.length > 0) {
    const hasDomainOrAnyonePerms = graphPermissions.some(
      (p) => p.role !== "owner" && (p.type === "domain" || p.type === "anyone")
    );
    share.notebookDomainSharingLimited = hasDomainOrAnyonePerms;
  }

  if (problems.length === 0 && !share.notebookDomainSharingLimited) {
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
  share.notebookDomainSharingLimited = false;
}

// =============================================================================
// Actions (continued)
// =============================================================================

export const publish = asAction(
  "Share.publish",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;

    const logger = Utils.Logging.getLogger(controller);
    logger.log(Utils.Logging.Formatter.verbose("Publishing"), LABEL);
    const share = controller.editor.share;

    const publishPermissions = getConfiguredPublishPermissions();
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

    if (share.hasPublicPermissions) {
      // Already published!
      return;
    }

    share.status = "changing-visibility";
    share.hasPublicPermissions = true;

    if (!share.shareableFile) {
      if (handleFatalShareError(await ensureShareableCopyExists())) {
        return;
      }
    }

    const permResult = await applyPermissionDiff(
      share.shareableFile!.id,
      [],
      publishPermissions
    );
    if (handleFatalShareError(permResult)) {
      return;
    }

    const graph = getGraph();
    if (graph) {
      if (
        handleFatalShareError(
          await handleAssetPermissions(share.shareableFile!.id, graph)
        )
      ) {
        return;
      }
    } else {
      /* c8 ignore start */
      logger.log(Utils.Logging.Formatter.error("No graph found"), LABEL);
      /* c8 ignore end */
    }

    share.status = "ready";
    share.hasPublicPermissions = true;
    share.actualPermissions = permResult.value;
  }
);

export const unpublish = asAction(
  "Share.unpublish",
  { mode: ActionMode.Immediate },
  async (): Promise<void> => {
    const { controller } = bind;
    const share = controller.editor.share;

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
    if (!share.hasPublicPermissions) {
      // Already unpublished!
      return;
    }
    const graph = getGraph();
    if (!graph) {
      /* c8 ignore start */
      logger.log(Utils.Logging.Formatter.error("No graph found"), LABEL);
      return;
      /* c8 ignore end */
    }
    share.status = "changing-visibility";
    share.hasPublicPermissions = false;

    if (
      handleFatalShareError(
        await applyPermissionDiff(
          share.shareableFile!.id,
          share.actualPermissions,
          []
        )
      )
    ) {
      return;
    }

    if (
      handleFatalShareError(
        await handleAssetPermissions(share.shareableFile!.id, graph)
      )
    ) {
      return;
    }

    share.status = "ready";
    share.hasPublicPermissions = false;
  }
);

/**
 * Unified visibility change for the v2 share panel 3-way dropdown.
 * Handles all transitions between only-you, restricted, and anyone.
 *
 * This action is v2-only. The v1 binary toggle continues to use
 * publish()/unpublish() directly.
 */
export const changeVisibility = asAction(
  "Share.changeVisibility",
  { mode: ActionMode.Immediate },
  async (target: VisibilityLevel): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;
    const logger = Utils.Logging.getLogger(controller);

    if (share.ownership !== "owner") {
      /* c8 ignore next */
      return;
    }

    const currentVisibility = share.visibility;
    if (currentVisibility === target) {
      return;
    }

    logger.log(
      Utils.Logging.Formatter.verbose(
        `Changing visibility: ${currentVisibility} → ${target}`
      ),
      LABEL
    );

    share.status = "changing-visibility";

    // Ensure shareable copy exists for any shared state.
    const copyResult = await ensureShareableCopyExists();
    if (handleFatalShareError(copyResult)) {
      return;
    }
    const shareableFileId = copyResult.value;

    // Read current permissions on the shareable copy.
    const metaResult = await resultify(() =>
      googleDriveClient.getFileMetadata(shareableFileId, {
        fields: ["permissions"],
        bypassProxy: true,
      })
    );
    if (handleFatalShareError(metaResult)) {
      return;
    }

    const actualPermissions = metaResult.value.permissions ?? [];
    const publishPermissions = getConfiguredPublishPermissions();

    let desiredPermissions: gapi.client.drive.Permission[];
    if (target === "only-you") {
      desiredPermissions = [];
    } else if (target === "anyone") {
      if (!share.publicPublishingAllowed) {
        logger.log(
          Utils.Logging.Formatter.error(
            "Public publishing is disallowed for this domain"
          ),
          LABEL
        );
        share.status = "ready";
        return;
      }
      desiredPermissions = publishPermissions;
    } else {
      target satisfies "restricted";
      desiredPermissions = actualPermissions.filter(
        (p) =>
          p.role !== "owner" &&
          !permissionMatchesAnyOfIgnoringRole(p, publishPermissions)
      );
    }

    if (
      handleFatalShareError(
        await applyPermissionDiff(
          shareableFileId,
          actualPermissions,
          desiredPermissions
        )
      )
    ) {
      return;
    }

    // Update controller state optimistically rather than re-reading from Drive.
    updateControllerPermissionState(desiredPermissions);

    // Sync asset permissions to match graph permissions.
    const graph = getGraph();
    if (graph) {
      if (
        handleFatalShareError(
          await handleAssetPermissions(shareableFileId, graph)
        )
      ) {
        return;
      }
    }

    // For restricted, open the native share dialog so the user
    // can add specific people. Keep the loading state so the selector
    // shows a spinner until the dialog closes and permissions re-sync.
    if (target === "restricted") {
      share.panel = "native-share";
    } else {
      share.status = "ready";
    }
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
      /* c8 ignore next */
      return;
    }
    const graph = getGraph();
    if (!graph) {
      /* c8 ignore start */
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.error("No graph found"),
        "Share.publishStale"
      );
      return;
      /* c8 ignore end */
    }

    share.status = "publishing-stale";

    const shareableFileUrl = new URL(`drive:/${share.shareableFile.id}`);
    const updatedShareableGraph = structuredClone(graph);
    delete updatedShareableGraph["url"];

    const staleUpdateResult = await resultify(() =>
      googleDriveClient.updateFileMetadata(
        share.shareableFile!.id,
        {
          properties: {
            [DRIVE_PROPERTY_LATEST_SHARED_VERSION]: share.editableVersion,
            ...writeViewerModeProperty(share.viewerMode),
          },
        },
        { fields: ["modifiedTime"] }
      )
    );
    // Ensure all assets have the same permissions as the shareable file,
    // since they might have been added since the last publish.
    if (
      handleFatalShareError(
        await handleAssetPermissions(share.shareableFile!.id, graph)
      )
    ) {
      return;
    }
    await boardServer.ops.writeGraphToDrive(
      shareableFileUrl,
      updatedShareableGraph
    );
    if (handleFatalShareError(staleUpdateResult)) {
      return;
    }

    share.status = "ready";
    share.sharedVersion = share.editableVersion;
    share.lastPublishedIso = staleUpdateResult.value.modifiedTime ?? "";

    Utils.Logging.getLogger(controller).log(
      Utils.Logging.Formatter.verbose(
        `Updated stale shareable graph copy` +
          ` "${share.shareableFile!.id}" to version` +
          ` "${share.editableVersion}".`
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
    const nlmClient = services.notebookLmApiClient;

    const problems = share.unmanagedAssetProblems;
    if (problems.length === 0) {
      return;
    }
    share.status = "syncing-assets";
    share.unmanagedAssetProblems = [];

    async function fixProblem(problem: UnmanagedAssetProblem): Promise<Result> {
      if (problem.problem !== "missing") {
        /* c8 ignore next */
        return ok();
      }
      if (problem.type === "drive") {
        const results = await Promise.all(
          problem.missing.map((permission) =>
            resultify(() =>
              googleDriveClient.createPermission(problem.asset.id, permission, {
                sendNotificationEmail: false,
              })
            )
          )
        );
        for (const r of results) {
          if (!r.ok) {
            return r;
          }
        }
      } else if (problem.type === "notebook") {
        const r = await resultify(() =>
          nlmClient.batchUpdateNotebookPermissions({
            name: `notebooks/${problem.notebookId}`,
            permissions: problem.missingEmails.map((email) => ({
              email,
              accessRole: NotebookAccessRole.VIEWER,
            })),
            sendEmailNotification: false,
          })
        );
        if (!r.ok) {
          return r;
        }
      }
      return ok();
    }

    const results = await Promise.all(problems.map(fixProblem));
    for (const r of results) {
      if (handleFatalShareError(r)) {
        return;
      }
    }
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

    if (share.status !== "ready") {
      Utils.Logging.getLogger(controller).log(
        Utils.Logging.Formatter.warning(
          `Cannot close panel while status is "${share.status}"`
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
      share.status = "syncing-native-share";
      const copyResult = await ensureShareableCopyExists();
      if (handleFatalShareError(copyResult)) {
        return;
      }
      shareableCopyFileId = copyResult.value;
      share.status = "ready";
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
    share.status = "syncing-native-share";
    const graph = getGraph();
    if (graph) {
      if (
        handleFatalShareError(await handleAssetPermissions(graphFileId, graph))
      ) {
        return;
      }
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
    // permissions and updates published/granularlyShared/actualPermissions.
    if (handleFatalShareError(await fetchShareData())) {
      return;
    }
    share.status = "ready";
  }
);

export const setViewerAccess = asAction(
  "Share.setViewerAccess",
  { mode: ActionMode.Immediate },
  async (level: ViewerMode): Promise<void> => {
    const { controller, services } = bind;
    const share = controller.editor.share;
    const googleDriveClient = services.googleDriveClient;

    if (share.ownership !== "owner") {
      return;
    }

    share.viewerMode = level;
    share.status = "changing-access";

    const copyResult = await ensureShareableCopyExists();
    if (handleFatalShareError(copyResult)) {
      return;
    }

    if (
      handleFatalShareError(
        await resultify(() =>
          googleDriveClient.updateFileMetadata(copyResult.value, {
            properties: writeViewerModeProperty(level),
          })
        )
      )
    ) {
      return;
    }

    share.status = "ready";
  }
);

function readViewerModeProperty(
  properties: Record<string, string> | undefined
): ViewerMode {
  const value = properties?.[DRIVE_PROPERTY_VIEWER_MODE] as
    | ViewerMode
    | undefined;
  return value === "app-only" ? "app-only" : "full";
}

function writeViewerModeProperty(level: ViewerMode): Record<string, string> {
  return {
    [DRIVE_PROPERTY_VIEWER_MODE]: level === "app-only" ? "app-only" : "",
  };
}
