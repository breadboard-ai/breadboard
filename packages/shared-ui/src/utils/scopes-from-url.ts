/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import type { OAuthScope } from "../connection/oauth-scopes.js";

/**
 * If we're in shell mode, when the iframed app makes a request to one of our
 * Node server APIs, the origin will be that of the app, not the shell. Note
 * that ultimately these APIs will all be replaced with APIs on the backend
 * server, so this is only temporary anyway.
 */
const ORIGIN_FOR_FRONTEND_SERVER_RPCS =
  CLIENT_DEPLOYMENT_CONFIG.SHELL_GUEST_ORIGIN || window.location.origin;

const ASSET_DRIVE_API_ENDPOINT = new URL(
  `/board/boards/@foo/bar/assets/drive`,
  ORIGIN_FOR_FRONTEND_SERVER_RPCS
);

const DATA_TRANSFORM_API_ENDPOINT = new URL(
  `/api/data/transform`,
  ORIGIN_FOR_FRONTEND_SERVER_RPCS
);

const PROXY_API_ENDPOINT = new URL(
  `/board/proxy`,
  ORIGIN_FOR_FRONTEND_SERVER_RPCS
);

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

const URL_SCOPE_MAPPINGS: Array<[URL, OAuthScope[]]> = [
  [PROXY_API_ENDPOINT, GENAI_SCOPES],
  [ASSET_DRIVE_API_ENDPOINT, DRIVE_SCOPES],
  [DATA_TRANSFORM_API_ENDPOINT, [...DRIVE_SCOPES, ...GENAI_SCOPES]],
  [new URL("https://www.googleapis.com/calendar/"), CALENDAR_SCOPES],
  [new URL("https://www.googleapis.com/drive/"), DRIVE_SCOPES],
  [new URL("https://docs.googleapis.com/v1/documents/"), DRIVE_SCOPES],
  [new URL("https://slides.googleapis.com/v1/presentations/"), DRIVE_SCOPES],
  [new URL("https://sheets.googleapis.com/v4/spreadsheets/"), DRIVE_SCOPES],
  [new URL("https://www.googleapis.com/upload/drive/v3/"), DRIVE_SCOPES],
  [new URL("https://gmail.googleapis.com/"), GMAIL_SCOPES],
  [
    new URL("https://generativelanguage.googleapis.com/v1beta/models/"),
    GENAI_SCOPES,
  ],
];

const { BACKEND_API_ENDPOINT } = CLIENT_DEPLOYMENT_CONFIG;
if (BACKEND_API_ENDPOINT) {
  URL_SCOPE_MAPPINGS.push([new URL(BACKEND_API_ENDPOINT), GENAI_SCOPES]);
} else {
  console.warn(
    `BACKEND_API_ENDPOINT was not configured, ` +
      `backend RPCs with credentials will be unavailable.`
  );
}

export function scopesFromUrl(url: string): OAuthScope[] | undefined {
  const parsedUrl = new URL(url);
  for (const [scopeUrl, scopes] of URL_SCOPE_MAPPINGS) {
    if (
      parsedUrl.origin === scopeUrl.origin &&
      parsedUrl.pathname.startsWith(scopeUrl.pathname)
    ) {
      return scopes;
    }
  }
}
