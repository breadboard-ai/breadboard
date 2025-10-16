import "dotenv/config";

export type SameSite = "Lax" | "None" | "Strict";

export const ALLOWED_ORIGINS: string[] = getStringList("ALLOWED_ORIGINS", {
  delimiter: /\s+/,
});

export const OAUTH_CLIENT: string = getString("OAUTH_CLIENT");

export const OAUTH_SCOPES: string[] = getStringList("OAUTH_SCOPES");

export const OAUTH_SECRET: string = getString("OAUTH_SECRET");

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

/**
 * Get the value of the given flag as a boolean.
 *
 * Anything other than the literal string "true" (case-insensitive) will be
 * interpreted as false
 */
function getBoolean(flagName: string): boolean {
  return getString(flagName).toLowerCase() === "true";
}

function getSameSite(flagName: string, opts: { default: SameSite }): SameSite {
  const flagValue = getString(flagName) || opts.default;
  if (!["Lax", "Strict", "None"].includes(flagValue)) {
    throw Error(`Invalid ${flagName} value: ${flagValue}`);
  }
  return flagValue as SameSite;
}
