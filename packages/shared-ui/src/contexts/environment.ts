/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { InputPlugin } from "../plugins/input-plugin.js";

export type GoogleDrivePermission =
  | { id: string; type: "user"; emailAddress: string }
  | { id: string; type: "group"; emailAddress: string }
  | { id: string; type: "domain"; domain: string }
  | { id: string; type: "anyone" };

export interface Environment {
  connectionServerUrl: string | undefined;
  connectionRedirectUrl: string;
  requiresSignin?: boolean;
  plugins: {
    input: InputPlugin[];
  };
  googleDrive: {
    publishPermissions: GoogleDrivePermission[];
    publicApiKey: string;
  };
}

export const environmentContext = createContext<Environment>("bb-environment");
