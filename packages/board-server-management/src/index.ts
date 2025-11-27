/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import { BoardServer, User } from "@google-labs/breadboard";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import type { SignInInfo } from "@breadboard-ai/types/sign-in-info.js";

function createGoogleDriveBoardServer(
  title: string,
  user: User,
  signInInfo: SignInInfo,
  googleDriveClient?: GoogleDriveClient
) {
  if (!googleDriveClient) {
    console.error(
      "The Google Drive board server could not be initialized because" +
        " a GoogleDriveClient was not provided"
    );
    return null;
  }
  const googleDrivePublishPermissions =
    CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_PUBLISH_PERMISSIONS ?? [];
  const userFolderName =
    CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_USER_FOLDER_NAME || "Breadboard";
  return new GoogleDriveBoardServer(
    title,
    user,
    signInInfo,
    googleDriveClient,
    googleDrivePublishPermissions,
    userFolderName,
    CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT ?? ""
  );
}

export function getBoardServers(
  signInInfo: SignInInfo,
  googleDriveClient?: GoogleDriveClient
): BoardServer[] {
  const server = createGoogleDriveBoardServer(
    "Google Drive",
    { apiKey: "", secrets: new Map(), username: "board-builder " },
    signInInfo,
    googleDriveClient
  );

  if (!server) return [];

  return [server];
}

export { BoardServerAwareDataStore } from "./board-server-aware-data-store";
