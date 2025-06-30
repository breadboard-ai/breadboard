/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests if a string is Board URL-like. A "URL-like string", at least in Breadboard
 * definition, has these properties:
 * - it may have a distinct structure of an absolute URL, starting with a scheme
 *  followed by a colon, e.g. "https://example.com", "file:///path/to/file",
 * "data:text/plain,Hello%2C%20World", etc.
 * - it may start with a fragment identifier, e.g. "#foo", "#bar", etc.
 * - it may start with a "./"
 *
 * Otherwise, the string is not URL-like.
 */
export function graphUrlLike(s: string): boolean {
  if (s.startsWith("#")) {
    try {
      new URL(s, "http://example.com");
    } catch (e) {
      return false;
    }
    return true;
  } else if (s.includes(":") || s.startsWith("./")) {
    try {
      new URL(s, "http://example.com");
    } catch (e) {
      return false;
    }
    return true;
  } else {
    return false;
  }
}
