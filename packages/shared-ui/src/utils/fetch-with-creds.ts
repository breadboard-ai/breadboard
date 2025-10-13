/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";
import { createFetchWithCreds as createFetchWithCredsGeneric } from "@breadboard-ai/utils";

const ASSET_DRIVE_API_ENDPOINT = new URL(
  `/board/boards/@foo/bar/assets/drive`,
  window.location.href
).href;

const PROXY_API_ENDPOINT = new URL(`/board/proxy`, window.location.href).href;

const CALENDAR_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.owned",
];

const DRIVE_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/drive.readonly",
];

const GMAIL_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/gmail.modify",
];

const GENAI_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/generative-language.retriever",
];

const URL_SCOPE_MAP: ReadonlyMap<string, OAuthScope[]> = new Map([
  [PROXY_API_ENDPOINT, GENAI_SCOPES],
  [ASSET_DRIVE_API_ENDPOINT, DRIVE_SCOPES],
  ["https://www.googleapis.com/calendar/", CALENDAR_SCOPES],
  ["https://www.googleapis.com/drive/", DRIVE_SCOPES],
  ["https://docs.googleapis.com/v1/documents/", DRIVE_SCOPES],
  ["https://slides.googleapis.com/v1/presentations/", DRIVE_SCOPES],
  ["https://sheets.googleapis.com/v4/spreadsheets/", DRIVE_SCOPES],
  ["https://www.googleapis.com/upload/drive/v3/", DRIVE_SCOPES],
  ["https://gmail.googleapis.com", GMAIL_SCOPES],
  ["https://generativelanguage.googleapis.com/v1beta/models/", GENAI_SCOPES],
]);

export type FetchWithCredsConfig = {
  adapter: SigninAdapter;
  backendApiEndpoint?: string;
};

export function createFetchWithCreds(
  config: FetchWithCredsConfig
): typeof fetch {
  return createFetchWithCredsGeneric(async (url) => {
    const scopes = scopesFromUrl(url, config.backendApiEndpoint);
    if (!scopes) {
      throw new Error(`Unknown URL: ${url}. Unable to fetch.`);
    }
    let token: string | undefined;
    const tokenResult = await config.adapter.token(scopes);
    if (tokenResult.state === "valid") {
      token = tokenResult.grant.access_token;
    }
    if (!token) {
      throw new Error(`Unable to obtain access token for URL ${url}`);
    }
    return token;
  });
}

function scopesFromUrl(
  url: string,
  backendApiEndpoint: string | undefined
): OAuthScope[] | undefined {
  if (!backendApiEndpoint) {
    console.warn(
      `Backend API Endpoint not specified, falling back to current location`
    );
    backendApiEndpoint = window.location.href;
  }

  let scopes: OAuthScope[] | undefined;
  for (const [urlPattern, urlScopes] of URL_SCOPE_MAP.entries()) {
    if (url.startsWith(urlPattern)) {
      scopes = urlScopes;
      break;
    }
  }
  if (!scopes && url.startsWith(backendApiEndpoint)) {
    scopes = GENAI_SCOPES;
  }
  return scopes;
}
