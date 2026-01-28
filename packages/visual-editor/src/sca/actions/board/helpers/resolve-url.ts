/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks if a URL can be parsed, handling older browsers that don't have URL.canParse().
 *
 * @param url The URL to check
 * @param base Optional base URL for relative URLs
 * @returns True if the URL can be parsed
 */
export function canParse(url: string, base?: string): boolean {
  // TypeScript assumes that if `canParse` does not exist, then URL is
  // `never`. However, in older browsers that's not true.
  if ("c" + "anParse" in URL) {
    return URL.canParse(url, base);
  }

  try {
    new URL(url, base);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a board URL relative to the current board's URL.
 *
 * @param boardUrl The URL to resolve (may be relative or absolute)
 * @param currentUrl The current board's URL to use as base for resolution
 * @returns The resolved URL, or the original URL if resolution fails
 */
export function resolveUrl(
  boardUrl: string | null,
  currentUrl: string | null
): string | null {
  if (!boardUrl) {
    return null;
  }

  // If the URL can be fully parsed on its own and we have a base,
  // try to resolve it relative to the current board
  if (canParse(boardUrl) && currentUrl) {
    try {
      const base = new URL(currentUrl);
      const resolved = new URL(boardUrl, base);
      return resolved.href;
    } catch {
      console.warn("Unable to parse URL from current board:", currentUrl);
    }
  }

  // Return as-is (likely an example board or already absolute)
  return boardUrl;
}

/**
 * Adds a resource key parameter to a URL if one exists in the reference URL.
 *
 * @param url The URL to potentially add the resource key to
 * @param referenceUrl The URL to extract the resource key from
 * @returns The URL with resource key added, or original URL if none exists
 */
export function addResourceKeyIfPresent(
  url: string,
  referenceUrl: string | null
): string {
  if (!referenceUrl) {
    return url;
  }

  try {
    const refUrl = new URL(referenceUrl);
    const resourceKey = refUrl.searchParams.get("resourcekey");
    if (resourceKey) {
      return `${url}?resourcekey=${resourceKey}`;
    }
  } catch {
    // referenceUrl is not a valid URL, ignore
  }

  return url;
}
