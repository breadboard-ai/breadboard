import "dotenv/config";

import { readFileSync } from "node:fs";

export type SameSite = "Lax" | "None" | "Strict";

export const ALLOWED_ORIGINS: string[] = getStringList("ALLOWED_ORIGINS", {
  delimiter: /\s+/,
});

export const OAUTH_CLIENT: string = getString("OAUTH_CLIENT");

export const OAUTH_SCOPES: string[] = getStringList("OAUTH_SCOPES");

export const OAUTH_SECRET: string = getSecret("OAUTH_SECRET");

export const OAUTH_FETCH_COMMAND: string = getString("OAUTH_FETCH_COMMAND");

export const GOOGLE_OAUTH_AUTH_ENDPOINT: string = getString(
  "GOOGLE_OAUTH_AUTH_ENDPOINT"
);

export const GOOGLE_OAUTH_TOKEN_ENDPOINT: string = getString(
  "GOOGLE_OAUTH_TOKEN_ENDPOINT"
);

export const REFRESH_TOKEN_COOKIE_SAME_SITE: SameSite = getSameSite(
  "REFRESH_TOKEN_COOKIE_SAME_SITE",
  {
    default: "Strict",
  }
);

/** Get the value of the given flag as a string, or empty string if absent. */
function getString(flagName: string): string {
  return process.env[flagName] ?? "";
}

/** Get the value of the given flag as a comma-delimited list of strings. */
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

function getSameSite(flagName: string, opts: { default: SameSite }): SameSite {
  const flagValue = getString(flagName) || opts.default;
  if (!["Lax", "Strict", "None"].includes(flagValue)) {
    throw Error(`Invalid ${flagName} value: ${flagValue}`);
  }
  return flagValue as SameSite;
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
