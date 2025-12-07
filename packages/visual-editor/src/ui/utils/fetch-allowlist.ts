/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import type { OAuthScope } from "../connection/oauth-scopes.js";
import * as CANONICAL from "@breadboard-ai/types/canonical-endpoints.js";

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

function urlOrUndefined(url: string | undefined): URL | undefined {
  return url ? new URL(url) : undefined;
}

const FETCH_ALLOWLIST: Array<{
  canonicalPrefix: URL;
  scopes: OAuthScope[];
  remapOrigin?: URL;
  attachAccessToken?: (url: string) => boolean;
}> = [
  {
    canonicalPrefix: new URL(CANONICAL.BACKEND_API_PREFIX),
    scopes: GENAI_SCOPES,
    remapOrigin: urlOrUndefined(CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT),
    attachAccessToken: (url: string) =>
      url.endsWith("/uploadGeminiFile") ||
      url.endsWith("/uploadBlobFile") ||
      url.includes("/generateWebpageStream"),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_DRIVE_FILES_API_PREFIX),
    scopes: DRIVE_SCOPES,
    remapOrigin: urlOrUndefined(
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_API_ENDPOINT
    ),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_DRIVE_UPLOAD_API_PREFIX),
    scopes: DRIVE_SCOPES,
    remapOrigin: urlOrUndefined(
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_API_ENDPOINT
    ),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_DOCS_API_PREFIX),
    scopes: DRIVE_SCOPES,
    remapOrigin: urlOrUndefined(
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_API_ENDPOINT
    ),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_SLIDES_API_PREFIX),
    scopes: DRIVE_SCOPES,
    remapOrigin: urlOrUndefined(
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_API_ENDPOINT
    ),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_SHEETS_API_PREFIX),
    scopes: DRIVE_SCOPES,
    remapOrigin: urlOrUndefined(
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_API_ENDPOINT
    ),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_GENAI_API_PREFIX),
    scopes: GENAI_SCOPES,
    // Not currently configurable
    remapOrigin: undefined,
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_CALENDAR_API_PREFIX),
    scopes: CALENDAR_SCOPES,
    // Not currently configurable
    remapOrigin: undefined,
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_GMAIL_API_PREFIX),
    scopes: GMAIL_SCOPES,
    // Not currently configurable
    remapOrigin: undefined,
  },
];

export interface FetchAllowlistInfo {
  scopes: OAuthScope[];
  remappedUrl: URL | undefined;
  attachAccessToken: boolean;
}

export function checkFetchAllowlist(
  urlStr: string
): FetchAllowlistInfo | undefined {
  let url = new URL(urlStr);
  for (const {
    canonicalPrefix,
    scopes,
    remapOrigin,
    attachAccessToken,
  } of FETCH_ALLOWLIST) {
    if (
      url.origin === canonicalPrefix.origin &&
      url.pathname.startsWith(canonicalPrefix.pathname)
    ) {
      let remappedUrl: URL | undefined = undefined;
      if (remapOrigin && remapOrigin.origin !== url.origin) {
        remappedUrl = new URL(
          remapOrigin.origin + url.pathname + url.search + url.hash
        );
      }
      return {
        scopes,
        remappedUrl,
        attachAccessToken: !!attachAccessToken?.(urlStr),
      };
    }
  }
  return undefined;
}
