/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { createAICreditsUrl, createMembershipUrl };

/**
 * Creates a user-specific suffix for Google One URLs based on the authuser index.
 * For multi-account users, this ensures the correct account is used.
 */
function createUserSuffix(authuser: number): string {
  return authuser !== 0 ? `/u/${authuser + 1}` : "";
}

/**
 * Creates a URL to the Google One AI credits page for the specified user.
 * @param authuser - The authuser index (0-based)
 * @param campaign - The utm_campaign value for tracking
 */
function createAICreditsUrl(authuser: number, campaign: string): string {
  const userSuffix = createUserSuffix(authuser);
  return `https://one.google.com${userSuffix}/ai/credits?utm_source=opal&utm_medium=web&utm_campaign=${campaign}`;
}

/**
 * Creates a URL to the Google One membership settings page for the specified user.
 * @param authuser - The authuser index (0-based)
 */
function createMembershipUrl(authuser: number): string {
  const userSuffix = createUserSuffix(authuser);
  return `https://one.google.com${userSuffix}/settings?utm_source=opal&utm_medium=web&utm_campaign=opal_manage_membership`;
}
