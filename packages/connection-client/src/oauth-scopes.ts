/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const OAUTH_SCOPES = {
  // https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
  openid: {
    category: "Google Account",
    // Always required according to the OpenID Connect Core spec.
    required: true,
  },

  // https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
  profile: {
    aliases: ["https://www.googleapis.com/auth/userinfo.profile"],
    category: "Google Account",
  } satisfies OAuthScopeInfo,

  // https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
  email: {
    aliases: ["https://www.googleapis.com/auth/userinfo.email"],
    category: "Google Account",
    // Required for checking geo-location.
    required: true,
  },

  // https://developers.google.com/workspace/drive/api/guides/api-specific-auth#drive-scopes
  "https://www.googleapis.com/auth/drive.readonly": {
    category: "Google Drive",
  },

  // https://developers.google.com/workspace/drive/api/guides/api-specific-auth#drive-scopes
  "https://www.googleapis.com/auth/drive.file": {
    category: "Google Drive",
  },

  // https://ai.google.dev/gemini-api/docs/oauth
  "https://www.googleapis.com/auth/generative-language.retriever": {
    category: "Gemini",
  },

  // https://developers.google.com/workspace/calendar/api/auth
  "https://www.googleapis.com/auth/calendar.readonly": {
    category: "Google Calendar",
  },
} as const satisfies Record<string, OAuthScopeInfo>;

type OAuthScopeInfo = {
  /**
   * If true, this scope will always be requested, regardless of which specific
   * scopes are being requested at the time.
   */
  required?: boolean;

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

export type OAuthScope = keyof typeof OAUTH_SCOPES;

export const ALWAYS_REQUIRED_OAUTH_SCOPES = Object.entries(OAUTH_SCOPES)
  .filter(([, info]) => "required" in info && info.required)
  .map(([scope]) => scope);

const OAUTH_SCOPE_ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, info] of Object.entries(OAUTH_SCOPES)) {
  if ("aliases" in info) {
    for (const alias of info.aliases) {
      OAUTH_SCOPE_ALIAS_TO_CANONICAL.set(alias, canonical);
    }
  }
}

export function canonicalizeOAuthScope(scope: string): string {
  return OAUTH_SCOPE_ALIAS_TO_CANONICAL.get(scope) ?? scope;
}
