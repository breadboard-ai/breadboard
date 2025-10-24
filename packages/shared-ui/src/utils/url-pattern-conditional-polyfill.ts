/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export {};

/**
 * The native version of URLPattern if it's available, otherwise a polyfill.
 * URLPattern is Baseline 2025, but let's conditionally polyfill until we're
 * certain a sufficient % of our users doesn't need it.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API
 */
if (!(globalThis as { URLPattern?: URLPattern }).URLPattern) {
  await import("urlpattern-polyfill");
}
