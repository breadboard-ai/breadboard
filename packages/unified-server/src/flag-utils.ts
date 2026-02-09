/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from "node:fs";

export { getString, getStringList, getBoolean, getJson, getSecret };

/** Get the value of the given flag as a string, or empty string if absent. */
function getString(flagName: string): string {
  return process.env[flagName] ?? "";
}

/** Get the value of the given flag as a delimited list of strings. */
function getStringList(
  flagName: string,
  opts: { delimiter: string | RegExp } = { delimiter: "," }
): string[] {
  return (
    getString(flagName)
      .split(opts.delimiter)
      // Filter out empty strings (e.g. if the env value is empty)
      .filter((x) => x)
  );
}

/**
 * Get the value of the given flag as a boolean.
 *
 * Anything other than the literal string "true" (case-insensitive) will be
 * interpreted as false
 */
function getBoolean(flagName: string): boolean {
  return getString(flagName).toLowerCase() === "true";
}

function getJson(flagName: string): unknown {
  const str = getString(flagName);
  if (!str) {
    return undefined;
  }
  console.log(`[unified-server startup] Parsing ${flagName}`);
  return JSON.parse(str);
}

/**
 * Get the value of the given flag as a secret string.
 *
 * If the value is a file:// URI (e.g. "file:///path/to/secret"), the secret
 * is read from that file. Otherwise, the raw value is returned.
 */
function getSecret(flagName: string): string {
  const value = getString(flagName);
  if (value.startsWith("file://")) {
    const filePath = new URL(value).pathname;
    return readFileSync(filePath, "utf-8").trim();
  }
  return value;
}
