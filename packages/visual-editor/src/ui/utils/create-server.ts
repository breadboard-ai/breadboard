/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveBoardServer } from "../../board-server/server.js";
import { type GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import type { SignInInfo } from "@breadboard-ai/types/sign-in-info.js";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

export function createGoogleDriveBoardServer(
  signInInfo: SignInInfo,
  googleDriveClient: GoogleDriveClient,
  findUserOpalFolder: OpalShellHostProtocol["findUserOpalFolder"],
  listUserOpals: OpalShellHostProtocol["listUserOpals"]
): GoogleDriveBoardServer {
  const googleDrivePublishPermissions =
    CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_PUBLISH_PERMISSIONS ?? [];
  const userFolderName =
    CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_USER_FOLDER_NAME || "Breadboard";
  return new GoogleDriveBoardServer(
    "Google Drive",
    signInInfo,
    googleDriveClient,
    googleDrivePublishPermissions,
    userFolderName,
    findUserOpalFolder,
    listUserOpals
  );
}
