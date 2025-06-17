/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const REDIRECT_PARAM = "oauth_redirect";

/**
 * Returns embedder-provided redirect URI if valid.
 *
 * Retrieves redirect URI as provided in search params and validates
 * against the build-time provided list of valid redirect origins.
 * If there is no provided redirect URI, or the one provided is not
 * on the list, returns null.
 */
export function getEmbedderRedirectUri(): string | null {
  const embedderRedirectUrl = getEmbedderRedirectUrl();
  return embedderRedirectUrl ? embedderRedirectUrl.href : null;
}

/**
 * Returns embedder-provided origin if valid; otherwise returns window origin.
 *
 * Retrieves redirect origin as provided in search params and validates
 * against the build-time provided list of valid redirect origins.
 * If there is no provided redirect URI, or the one provided is not
 * on the allowlist, return the window origin.
 */
export function getTopLevelOrigin(): string {
  const embedderRedirectUrl = getEmbedderRedirectUrl();
  return embedderRedirectUrl
    ? embedderRedirectUrl.origin
    : window.location.origin;
}

function getEmbedderRedirectUrl(): URL | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(REDIRECT_PARAM)) {
    return null;
  }
  const embeddedRedirectUri = new URL(params.get(REDIRECT_PARAM)!);
  const validRedirectOrigins = JSON.parse(
    import.meta.env.VITE_VALID_REDIRECT_URI_ORIGINS || `[]`
  );
  return validRedirectOrigins.includes(embeddedRedirectUri.origin)
    ? embeddedRedirectUri
    : null;
}
