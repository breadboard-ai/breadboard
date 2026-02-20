/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type RuntimeFlags } from "./flags.js";

export type ClientDeploymentConfiguration = {
  ALLOWED_REDIRECT_ORIGINS?: string[];
  MEASUREMENT_ID?: string;
  BACKEND_API_ENDPOINT?: string;
  ENVIRONMENT_NAME?: string;
  ENABLE_SHARING_2?: boolean;
  GOOGLE_OAUTH_TOKEN_ENDPOINT?: string;
  GOOGLE_OAUTH_AUTH_ENDPOINT?: string;
  GOOGLE_DOCS_API_ENDPOINT?: string;
  GOOGLE_SHEETS_API_ENDPOINT?: string;
  GOOGLE_SLIDES_API_ENDPOINT?: string;
  GOOGLE_DRIVE_API_ENDPOINT?: string;
  GOOGLE_DRIVE_PUBLISH_PERMISSIONS?: GoogleDrivePermission[];
  GOOGLE_DRIVE_USER_FOLDER_NAME?: string;
  GOOGLE_FEEDBACK_PRODUCT_ID?: string;
  GOOGLE_FEEDBACK_BUCKET?: string;
  SURVEY_MODE?: "on" | "off" | "test";
  SURVEY_API_KEY?: string;
  SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID?: string;
  OAUTH_CLIENT: string;
  SHELL_GUEST_ORIGIN?: string;
  SHELL_HOST_ORIGINS?: string[];
  SHELL_PREFIX?: string;
  /**
   * Allow running 3P modules (modules that are other than A2). Default
   * value is "false"
   */
  ALLOW_3P_MODULES?: boolean;

  FAKE_MODE?: boolean;
  SHARE_SURFACE_URL_TEMPLATES: Record<string, string>;
  domains?: Record<string, DomainConfiguration>;
  flags: RuntimeFlags;
};

export interface DomainConfiguration {
  /**
   * If set, a notification will appear telling users from this domain to visit
   * this other deployment instead of the current one.
   */
  preferredUrl?: string;

  /**
   * If true, the simple publishing flow will be disabled for users from this
   * domain. Granular sharing with specific people and groups will still be
   * available.
   */
  disallowPublicPublishing?: boolean;
}

export type GoogleDrivePermission =
  | { id: string; type: "user"; emailAddress: string }
  | { id: string; type: "group"; emailAddress: string }
  | { id: string; type: "domain"; domain: string }
  | { id: string; type: "anyone" };
