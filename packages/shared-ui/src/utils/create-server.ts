/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import type { SignInInfo } from "@breadboard-ai/types/sign-in-info.js";

export function createGoogleDriveBoardServer(
  signInInfo: SignInInfo,
  googleDriveClient: GoogleDriveClient
): GoogleDriveBoardServer {
  const googleDrivePublishPermissions =
    CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_PUBLISH_PERMISSIONS ?? [];
  const userFolderName =
    CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_USER_FOLDER_NAME || "Breadboard";
  return new GoogleDriveBoardServer(
    "Google Drive",
    { apiKey: "", secrets: new Map(), username: "board-builder " },
    signInInfo,
    googleDriveClient,
    googleDrivePublishPermissions,
    userFolderName,
    CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT ?? ""
  );
}
