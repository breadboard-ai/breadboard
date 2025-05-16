/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const REDIRECT_PARAM = "oauth_redirect";

/**
 * Returns embedder-provided redirect URI if valid.
 *
 * Retrieves redirect URI as provided in search params and validates
 * against the build-time provided list of valid redirect origins.
 * If there is no provided redirect URI, or the one provided is not
 * on the list, returns null.
 */
export function getEmbedderRedirectUri(): string | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(REDIRECT_PARAM)) {
    return null;
  }
  const embeddedRedirectUri = new URL(params.get(REDIRECT_PARAM)!);
  const validRedirectOrigins = JSON.parse(
    import.meta.env.VITE_VALID_REDIRECT_URI_ORIGINS || `[]`
  );
  return validRedirectOrigins.includes(embeddedRedirectUri.origin)
    ? embeddedRedirectUri.href
    : null;
}
