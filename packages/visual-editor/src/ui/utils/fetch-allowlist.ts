/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import type { OAuthScope } from "../connection/oauth-scopes.js";
import * as CANONICAL from "@breadboard-ai/types/canonical-endpoints.js";

type AllowListParams = {
  canonicalPrefix: URL;
  scopes: OAuthScope[];
  remapOrigin?: URL;
  allowQueryParams?: (params: URLSearchParams) => boolean;
  shouldAddAccessTokenToJsonBody?: (url: string) => boolean;
};

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

const FETCH_ALLOWLIST: AllowListParams[] = [
  {
    canonicalPrefix: new URL(CANONICAL.OPAL_BACKEND_API_PREFIX),
    scopes: GENAI_SCOPES,
    remapOrigin: urlOrUndefined(CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT),
    shouldAddAccessTokenToJsonBody: (url: string) =>
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
    allowQueryParams: (params) => !params.has("q"),
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
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DOCS_API_ENDPOINT
    ),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_SLIDES_API_PREFIX),
    scopes: DRIVE_SCOPES,
    remapOrigin: urlOrUndefined(
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_SLIDES_API_ENDPOINT
    ),
  },
  {
    canonicalPrefix: new URL(CANONICAL.GOOGLE_SHEETS_API_PREFIX),
    scopes: DRIVE_SCOPES,
    remapOrigin: urlOrUndefined(
      CLIENT_DEPLOYMENT_CONFIG.GOOGLE_SHEETS_API_ENDPOINT
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
  shouldAddAccessTokenToJsonBody: boolean;
}

export function checkFetchAllowlist(
  urlStr: string
): FetchAllowlistInfo | undefined {
  const url = new URL(urlStr);
  for (const params of FETCH_ALLOWLIST) {
    const {
      canonicalPrefix,
      scopes,
      remapOrigin,
      shouldAddAccessTokenToJsonBody,
      allowQueryParams,
    } = params;
    if (
      url.origin === canonicalPrefix.origin &&
      url.pathname.startsWith(canonicalPrefix.pathname)
    ) {
      if (allowQueryParams && !allowQueryParams(url.searchParams)) {
        return undefined;
      }
      let remappedUrl: URL | undefined = undefined;
      if (remapOrigin && remapOrigin.origin !== url.origin) {
        remappedUrl = new URL(
          remapOrigin.origin + url.pathname + url.search + url.hash
        );
      }
      return {
        scopes,
        remappedUrl,
        shouldAddAccessTokenToJsonBody:
          !!shouldAddAccessTokenToJsonBody?.(urlStr),
      };
    }
  }
  return undefined;
}
