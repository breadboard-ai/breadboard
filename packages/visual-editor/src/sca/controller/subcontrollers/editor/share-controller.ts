/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DriveFileId,
  NarrowedDriveFile,
} from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { RootController } from "../root-controller.js";
import { field } from "../../decorators/field.js";

export type ShareState =
  | { status: "closed" }
  | { status: "opening" }
  | { status: "loading" }
  | {
    status: "readonly";
    shareableFile: DriveFileId;
  }
  | {
    status: "writable";
    published: true;
    publishedPermissions: gapi.client.drive.Permission[];
    granularlyShared: boolean;
    shareableFile: DriveFileId & {
      stale: boolean;
      permissions: gapi.client.drive.Permission[];
      shareSurface: string | undefined;
    };
    latestVersion: string;
    userDomain: string;
  }
  | {
    status: "writable";
    published: false;
    granularlyShared: boolean;
    shareableFile:
    | (DriveFileId & {
      stale: boolean;
      permissions: gapi.client.drive.Permission[];
      shareSurface: string | undefined;
    })
    | undefined;
    latestVersion: string;
    userDomain: string;
  }
  | {
    status: "updating";
    published: boolean;
    granularlyShared: boolean;
    shareableFile:
    | (DriveFileId & { stale: boolean })
    | undefined;
    userDomain: string;
  }
  | {
    status: "granular";
    shareableFile: DriveFileId;
  }
  | {
    status: "unmanaged-assets";
    problems: UnmanagedAssetProblem[];
    oldState: ShareState;
    closed: { promise: Promise<void>; resolve: () => void };
  };

export type UnmanagedAssetProblem = {
  asset: NarrowedDriveFile<"id" | "resourceKey" | "name" | "iconLink">;
} & (
    | { problem: "cant-share" }
    | { problem: "missing"; missing: gapi.client.drive.Permission[] }
  );


export class ShareController extends RootController {
  @field()
  accessor state: ShareState = { status: "closed" };
}
