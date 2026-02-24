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
import type { AppEnvironment } from "../../../environment/environment.js";
import { makeUrl } from "../../../../ui/navigation/urls.js";
import { makeShareLinkFromTemplate } from "../../../../utils/make-share-link-from-template.js";

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type UnmanagedAssetProblem =
  | UnmanagedDriveAssetProblem
  | UnmanagedNotebookAssetProblem;

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type UnmanagedDriveAssetProblem = {
  type: "drive";
  asset: NarrowedDriveFile<"id" | "resourceKey" | "name" | "iconLink">;
} & (
  | { problem: "cant-share" }
  | { problem: "missing"; missing: gapi.client.drive.Permission[] }
);

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type UnmanagedNotebookAssetProblem = {
  type: "notebook";
  notebookId: string;
  notebookName: string;
} & (
  | { problem: "cant-share" }
  | { problem: "missing"; missingEmails: string[] }
);

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type SharePanelStatus = "closed" | "open" | "native-share";

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type VisibilityLevel = "only-you" | "broad" | "custom";

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
export type ViewerMode = "full" | "app-only";

// eslint-disable-next-line local-rules/no-exported-types-outside-types-ts
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
  | "syncing-assets";

export class ShareController extends RootController {
  readonly #env: AppEnvironment;

  constructor(
    controllerId: string,
    persistenceId: string,
    env: AppEnvironment
  ) {
    super(controllerId, persistenceId);
    this.#env = env;
  }

  @field()
  accessor status: ShareStatus = "initializing";

  @field()
  accessor panel: SharePanelStatus = "closed";

  @field()
  accessor ownership: "unknown" | "owner" | "non-owner" = "unknown";

  @field()
  accessor editableVersion = "";

  @field()
  accessor sharedVersion = "";

  get stale(): boolean {
    return (
      (this.hasBroadPermissions || this.hasCustomPermissions) &&
      this.editableVersion !== this.sharedVersion &&
      this.editableVersion !== "" &&
      this.sharedVersion !== ""
    );
  }
  @field()
  accessor hasBroadPermissions = false;

  @field()
  accessor hasCustomPermissions = false;

  get visibility(): VisibilityLevel {
    if (this.hasCustomPermissions) return "custom";
    if (this.hasBroadPermissions) return "broad";
    return "only-you";
  }

  get appUrl(): string {
    const file = this.shareableFile;
    if (!file) {
      return "";
    }
    const shareSurface = this.#env.guestConfig.shareSurface;
    const shareSurfaceUrlTemplate =
      shareSurface &&
      this.#env.guestConfig.shareSurfaceUrlTemplates?.[shareSurface];
    if (shareSurfaceUrlTemplate) {
      return makeShareLinkFromTemplate({
        urlTemplate: shareSurfaceUrlTemplate,
        fileId: file.id,
        resourceKey: file.resourceKey,
      });
    }
    const hostOrigin = this.#env.hostOrigin;
    if (!hostOrigin) {
      return "";
    }
    return makeUrl(
      {
        page: "graph",
        mode: "app",
        flow: `drive:/${file.id}`,
        resourceKey: file.resourceKey,
        guestPrefixed: false,
      },
      hostOrigin
    );
  }

  @field()
  accessor userDomain = "";

  @field()
  accessor broadPermissionsAllowed = true;

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

  @field()
  accessor lastPublishedIso = "";

  @field()
  accessor error = "";

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
    this.hasBroadPermissions = false;
    this.editableVersion = "";
    this.sharedVersion = "";
    this.hasCustomPermissions = false;
    this.userDomain = "";
    this.broadPermissionsAllowed = true;
    this.actualPermissions = [];
    this.shareableFile = null;
    this.unmanagedAssetProblems = [];
    this.notebookDomainSharingLimited = false;
    this.viewerMode = "full";
    this.lastPublishedIso = "";
    this.error = "";
    this.#inProgressPublish = null;
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

  #inProgressPublish: Promise<void> | null = null;

  /** Must be used with `using` so that cleanup runs on scope exit. */
  markPublishAsInProgress(): Disposable {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#inProgressPublish = promise;
    return {
      [Symbol.dispose]: () => {
        resolve();
        this.#inProgressPublish = null;
      },
    };
  }

  async waitForPublishToFinish(): Promise<void> {
    await this.#inProgressPublish;
  }
}
