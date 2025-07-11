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
  domains?: Record<string, DomainConfiguration>;
  flags: RuntimeFlags;
};

export interface DomainConfiguration {
  /**
   * A URL that users from this domain should usually use instead of the current
   * one.
   */
  preferredUrl?: string;
}

export type ServerDeploymentConfiguration = {
  BACKEND_API_ENDPOINT?: string;
  ENABLE_GOOGLE_DRIVE_PROXY?: boolean;
};
