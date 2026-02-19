/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DriveFileId,
  NarrowedDriveFile,
} from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

export type UnmanagedAssetProblem =
  | UnmanagedDriveAssetProblem
  | UnmanagedNotebookAssetProblem;

export type UnmanagedDriveAssetProblem = {
  type: "drive";
  asset: NarrowedDriveFile<"id" | "resourceKey" | "name" | "iconLink">;
} & (
  | { problem: "cant-share" }
  | { problem: "missing"; missing: gapi.client.drive.Permission[] }
);

export type UnmanagedNotebookAssetProblem = {
  type: "notebook";
  notebookId: string;
  notebookName: string;
} & (
  | { problem: "cant-share" }
  | { problem: "missing"; missingEmails: string[] }
);

export type SharePanelStatus = "closed" | "open" | "native-share";

export type VisibilityLevel = "only-you" | "restricted" | "anyone";

export type ViewerMode = "full" | "app-only";

export type ShareStatus =
  /** Fetching basic share state (ownership, permissions) on board load. */
  | "initializing"
  /** Nothing in progress. */
  | "ready"
  /** Creating the shareable copy before opening the native Drive share dialog,
   *  or re-reading permissions after the user closes it. */
  | "syncing-native-share"
  /** Publishing, unpublishing, or changing the visibility dropdown. */
  | "changing-visibility"
  /** Updating the viewer access level on the shareable copy. */
  | "changing-access"
  /** Updating the shareable copy with the latest board content. */
  | "publishing-stale"
  /** Syncing asset permissions after the user approves fixing unmanaged assets. */
  | "syncing-assets"
  /** An error occurred. */
  | "error";

export class ShareController extends RootController {
  @field()
  accessor status: ShareStatus = "initializing";

  @field()
  accessor panel: SharePanelStatus = "closed";

  @field()
  accessor ownership: "unknown" | "owner" | "non-owner" = "unknown";

  @field()
  accessor hasPublicPermissions = false;

  @field()
  accessor editableVersion = "";

  @field()
  accessor sharedVersion = "";

  get stale(): boolean {
    return (
      this.hasPublicPermissions &&
      this.editableVersion !== this.sharedVersion &&
      this.editableVersion !== "" &&
      this.sharedVersion !== ""
    );
  }

  @field()
  accessor hasOtherPermissions = false;

  get visibility(): VisibilityLevel {
    if (this.hasPublicPermissions) return "anyone";
    if (this.hasOtherPermissions) return "restricted";
    return "only-you";
  }

  @field()
  accessor userDomain = "";

  @field()
  accessor publicPublishingAllowed = true;

  @field({ deep: false })
  accessor actualPermissions: gapi.client.drive.Permission[] = [];

  @field()
  accessor shareableFile: DriveFileId | null = null;

  @field({ deep: false })
  accessor unmanagedAssetProblems: UnmanagedAssetProblem[] = [];

  @field()
  accessor notebookDomainSharingLimited = false;

  @field()
  accessor viewerMode: ViewerMode = "full";

  /**
   * Resets all fields to their defaults. Called when loading a new opal.
   *
   * TODO: Ideally Board.load would instantiate a new ShareController instead
   * of calling reset(), so new fields can't be accidentally missed. There
   * isn't currently an idiomatic SCA pattern for swapping controller instances.
   *
   * NOTE: These values must match the accessor initializers above. The
   * `@field()` decorator requires inline initializers, so we can't share a
   * single source of defaults. The reset() unit test guards against drift.
   */
  reset() {
    this.panel = "closed";
    this.status = "initializing";
    this.ownership = "unknown";
    this.hasPublicPermissions = false;
    this.editableVersion = "";
    this.sharedVersion = "";
    this.hasOtherPermissions = false;
    this.userDomain = "";
    this.publicPublishingAllowed = true;
    this.actualPermissions = [];
    this.shareableFile = null;
    this.unmanagedAssetProblems = [];
    this.notebookDomainSharingLimited = false;
    this.viewerMode = "full";
  }

  #resolveUnmanagedAssets?: () => void;

  /**
   * Creates a promise that blocks until the unmanaged-assets dialog is
   * resolved (via dismiss or fix).
   */
  waitForUnmanagedAssetsResolution(): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#resolveUnmanagedAssets = resolve;
    return promise;
  }

  /** Resolves the unmanaged-assets dialog promise. */
  resolveUnmanagedAssets() {
    this.#resolveUnmanagedAssets?.();
  }
}
