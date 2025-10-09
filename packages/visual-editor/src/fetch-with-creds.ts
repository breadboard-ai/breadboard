/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";

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
  ["https://gmail.googleapis.com", GMAIL_SCOPES],
  ["https://generativelanguage.googleapis.com/v1beta/models/", GENAI_SCOPES],
]);

export function createFetchWithCreds(adapter: SigninAdapter): typeof fetch {
  return async (request: URL | Request | string, init?: RequestInit) => {
    const manager = new FetchRequestManager(adapter, request, init);
    const requestWithCreds = await manager.createRequest();
    return fetch(requestWithCreds);
  };
}

class FetchRequestManager {
  readonly request: Request;

  constructor(
    public readonly adapter: SigninAdapter,
    request: URL | Request | string,
    init: RequestInit | undefined
  ) {
    this.request = new Request(request, init);
  }

  async getToken(): Promise<string> {
    let scopes: OAuthScope[] | undefined;
    const url = this.request.url;
    for (const [urlPattern, urlScopes] of URL_SCOPE_MAP.entries()) {
      if (url.startsWith(urlPattern)) {
        scopes = urlScopes;
        break;
      }
    }
    if (!scopes) {
      throw new Error(`Unknown URL: ${url}. Unable to fetch.`);
    }

    let token: string | undefined;
    const tokenResult = await this.adapter.token(scopes);
    if (tokenResult.state === "valid") {
      token = tokenResult.grant.access_token;
    }
    if (!token) {
      throw new Error(`Unable to obtain access token for URL ${url}`);
    }
    return token;
  }

  /**
   * For multi-part requests, we need to replace placeholder values with
   * the access tokens.
   * In particular, this is needed for batch requests, where each part
   * in the multipart body is a separate HTTP request, with its own
   * access token.
   */
  async maybeSubstituteTokens(token: string): Promise<Request> {
    // First, check to see if this is a multi-part POST request and exit early
    // if not.
    if (this.request.method === "GET") return this.request;
    const boundary = this.request.headers
      .get("Content-Type")
      ?.match(/boundary=(.*)/)?.[1];
    if (!boundary) return this.request;

    // Then, replace all placeholders that are shaped as
    // "Authorization: Bearer [${boundary}]" with the actual access token.
    const existingBody = await this.request.text();
    const body = existingBody.replaceAll(
      new RegExp(`^Authorization: Bearer \\[${boundary}\\]$`, "gm"),
      `Authorization: Bearer ${token}`
    );
    return new Request(this.request, { body });
  }

  async createRequest(): Promise<Request> {
    const oldHeaders = Object.fromEntries(this.request.headers.entries());
    const token = await this.getToken();
    const request = await this.maybeSubstituteTokens(token);

    const initWithCreds = {
      headers: {
        ...oldHeaders,
        Authorization: `Bearer ${token}`,
      },
    };
    return new Request(request, initWithCreds);
  }
}
