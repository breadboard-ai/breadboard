/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type RuntimeFlags } from "./flags.js";

export type ClientDeploymentConfiguration = {
  MEASUREMENT_ID?: string;
  BACKEND_API_ENDPOINT?: string;
  ENABLE_GOOGLE_DRIVE_PROXY?: boolean;
  FEEDBACK_LINK?: string;
  ENABLE_GOOGLE_FEEDBACK?: boolean;
  GOOGLE_FEEDBACK_PRODUCT_ID?: string;
  GOOGLE_FEEDBACK_BUCKET?: string;
  /**
   * Allow running 3P modules (modules that are other than A2). Default
   * value is "false"
   */
  ALLOW_3P_MODULES?: string;
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

export type ServerDeploymentConfiguration = {
  BACKEND_API_ENDPOINT?: string;
  ENABLE_GOOGLE_DRIVE_PROXY?: boolean;
  /**
   * The public API key (no extra privileges) that is used to access
   * Drive files.
   */
  GOOGLE_DRIVE_PUBLIC_API_KEY?: string;
  /**
   * The URL of the deployed server.
   */
  SERVER_URL?: string;
};
