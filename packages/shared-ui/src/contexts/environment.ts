/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";

export type GoogleDrivePermission =
  | { id: string; type: "user"; emailAddress: string }
  | { id: string; type: "group"; emailAddress: string }
  | { id: string; type: "domain"; domain: string }
  | { id: string; type: "anyone" };

export interface Environment {
  environmentName: string | undefined;
  connectionServerUrl: string | undefined;
  connectionRedirectUrl: string;
  requiresSignin?: boolean;
  googleDrive: {
    publishPermissions: GoogleDrivePermission[];
    publicApiKey: string;
  };
}

export const environmentContext = createContext<Environment>("bb-environment");
