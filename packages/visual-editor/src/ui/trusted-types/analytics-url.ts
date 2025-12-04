/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Note: As of December 2025, Firefox doesn't support Trusted Types.
const analyticsURLPolicy = window.trustedTypes?.createPolicy(
  "opal-analytics-url",
  { createScriptURL: createTrustedAnalyticsURLImpl }
);

export const createTrustedAnalyticsURL =
  analyticsURLPolicy?.createScriptURL.bind(analyticsURLPolicy) ??
  (createTrustedAnalyticsURLImpl as unknown as (
    analyticsId: string
  ) => TrustedScriptURL);

function createTrustedAnalyticsURLImpl(analyticsId: string): string {
  const url = new URL("https://www.googletagmanager.com/gtag/js");
  url.searchParams.set("id", analyticsId);
  return url.href;
}
