import "dotenv/config";

import { getString, getStringList, getSecret } from "../flag-utils.js";

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

function getSameSite(flagName: string, opts: { default: SameSite }): SameSite {
  const flagValue = getString(flagName) || opts.default;
  if (!["Lax", "Strict", "None"].includes(flagValue)) {
    throw Error(`Invalid ${flagName} value: ${flagValue}`);
  }
  return flagValue as SameSite;
}
