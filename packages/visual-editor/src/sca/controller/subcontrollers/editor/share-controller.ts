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

export type UnmanagedAssetProblem = {
  asset: NarrowedDriveFile<"id" | "resourceKey" | "name" | "iconLink">;
} & (
  | { problem: "cant-share" }
  | { problem: "missing"; missing: gapi.client.drive.Permission[] }
);

export type SharePanelStatus =
  | "closed"
  | "loading"
  | "readonly"
  | "writable"
  | "updating"
  | "native-share";

export type ShareStatus = "initializing" | "idle" | "updating" | "error";

export class ShareController extends RootController {
  @field()
  accessor panel: SharePanelStatus = "closed";

  @field()
  accessor status: ShareStatus = "initializing";

  @field()
  accessor ownership: "unknown" | "owner" | "non-owner" = "unknown";

  @field()
  accessor published = false;

  @field()
  accessor stale = false;

  @field()
  accessor granularlyShared = false;

  @field()
  accessor userDomain = "";

  @field()
  accessor publicPublishingAllowed = true;

  @field()
  accessor latestVersion = "";

  @field({ deep: false })
  accessor publishedPermissions: gapi.client.drive.Permission[] = [];

  @field()
  accessor shareableFile: DriveFileId | null = null;

  @field({ deep: false })
  accessor unmanagedAssetProblems: UnmanagedAssetProblem[] = [];

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
    this.published = false;
    this.stale = false;
    this.granularlyShared = false;
    this.userDomain = "";
    this.publicPublishingAllowed = true;
    this.latestVersion = "";
    this.publishedPermissions = [];
    this.shareableFile = null;
    this.unmanagedAssetProblems = [];
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
