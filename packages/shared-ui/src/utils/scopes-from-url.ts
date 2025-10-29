/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";

export { scopesFromUrl };

/**
 * If we're in shell mode, when the iframed app makes a request to one of our
 * Node server APIs, the origin will be that of the app, not the shell. Note
 * that ultimately these APIs will all be replaced with APIs on the backend
 * server, so this is only temporary anyway.
 */
const ORIGIN_FOR_FRONTEND_SERVER_RPCS =
  CLIENT_DEPLOYMENT_CONFIG.SHELL_GUEST_ORIGIN ?? window.location.origin;

const ASSET_DRIVE_API_ENDPOINT = new URL(
  `/board/boards/@foo/bar/assets/drive`,
  ORIGIN_FOR_FRONTEND_SERVER_RPCS
).href;

const DATA_TRANSFORM_API_ENDPOINT = new URL(
  `/api/data/transform`,
  ORIGIN_FOR_FRONTEND_SERVER_RPCS
).href;

const PROXY_API_ENDPOINT = new URL(
  `/board/proxy`,
  ORIGIN_FOR_FRONTEND_SERVER_RPCS
).href;

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
  [DATA_TRANSFORM_API_ENDPOINT, [...DRIVE_SCOPES, ...GENAI_SCOPES]],
  ["https://www.googleapis.com/calendar/", CALENDAR_SCOPES],
  ["https://www.googleapis.com/drive/", DRIVE_SCOPES],
  ["https://docs.googleapis.com/v1/documents/", DRIVE_SCOPES],
  ["https://slides.googleapis.com/v1/presentations/", DRIVE_SCOPES],
  ["https://sheets.googleapis.com/v4/spreadsheets/", DRIVE_SCOPES],
  ["https://www.googleapis.com/upload/drive/v3/", DRIVE_SCOPES],
  ["https://gmail.googleapis.com", GMAIL_SCOPES],
  ["https://generativelanguage.googleapis.com/v1beta/models/", GENAI_SCOPES],
]);

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
