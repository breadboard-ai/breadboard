/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Note the keys here are short names that are only valid within this codebase,
 * for convenience.
 */
const OAUTH_SCOPE_INFO = {
  // https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
  openid: {
    canonical: "openid",
    category: "Google Account",
  },

  // https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
  profile: {
    canonical: "profile",
    aliases: ["https://www.googleapis.com/auth/userinfo.profile"],
    category: "Google Account",
  } satisfies OAuthScopeInfo,

  // https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
  email: {
    canonical: "email",
    aliases: ["https://www.googleapis.com/auth/userinfo.email"],
    category: "Google Account",
  },

  // https://developers.google.com/workspace/drive/api/guides/api-specific-auth#drive-scopes
  "drive.readonly": {
    canonical: "https://www.googleapis.com/auth/drive.readonly",
    category: "Google Drive",
  },

  // https://developers.google.com/workspace/drive/api/guides/api-specific-auth#drive-scopes
  "drive.file": {
    canonical: "https://www.googleapis.com/auth/drive.file",
    category: "Google Drive",
  },

  // https://ai.google.dev/gemini-api/docs/oauth
  "generative-language.retriever": {
    canonical: "https://www.googleapis.com/auth/generative-language.retriever",
    category: "Gemini",
  },
} as const satisfies Record<string, OAuthScopeInfo>;

type OAuthScopeInfo = {
  /**
   * The actual canonical OAuth scope value that we will request.
   */
  canonical: string;

  /**
   * Some scopes have multiple valid values that mean the same exact thing.
   */
  aliases?: string[];

  /**
   * A short human-readable category label that may be shown to the user when
   * requesting scopes.
   *
   * Note we don't want to provide specific detail about each individual scope,
   * because there is an official description that will be shown to the user
   * when they are in the OAuth flow, and it would be confusing if we describe
   * it in a different way.
   */
  category: string;
};

export type OAuthScopeShortName = keyof typeof OAUTH_SCOPE_INFO;

type OAuthScopeCanonical =
  (typeof OAUTH_SCOPE_INFO)[OAuthScopeShortName]["canonical"];

export function expandOAuthScopeShortNames(
  shortNames: Array<OAuthScopeShortName>
): OAuthScopeCanonical[] {
  return shortNames.map((shortName) => OAUTH_SCOPE_INFO[shortName].canonical);
}

const OAUTH_SCOPE_ALIAS_TO_CANONICAL = new Map<string, string>();
for (const { value, aliases } of Object.values(
  OAUTH_SCOPE_ALIAS_TO_CANONICAL
)) {
  if (aliases) {
    for (const alias of aliases) {
      OAUTH_SCOPE_ALIAS_TO_CANONICAL.set(alias, value);
    }
  }
}

export function canonicalizeOAuthScope(scope: string): string {
  return OAUTH_SCOPE_ALIAS_TO_CANONICAL.get(scope) ?? scope;
}
