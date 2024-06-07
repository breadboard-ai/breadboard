/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Config } from "../config.js";
import { badRequestJson, internalServerError, okJson } from "../responses.js";

interface GrantRequest {
  connection_id: string;
  code: string;
  redirect_path: string;
}

// IMPORTANT: Keep in sync with
// breadboard/packages/breadboard-ui/src/elements/connection/connection-common.ts
type GrantResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
      refresh_token: string;
    };

/**
 * API which performs first-time authorization for a connection.
 */
export async function grant(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config
): Promise<void> {
  const params = Object.fromEntries(
    new URL(req.url ?? "", "http://example.com").searchParams.entries()
  ) as object as GrantRequest;
  if (!params.connection_id) {
    return badRequestJson(res, { error: "missing connection_id" });
  }
  if (!params.code) {
    return badRequestJson(res, { error: "missing code" });
  }

  const secretData = config.secrets.get(params.connection_id);
  if (!secretData) {
    return badRequestJson(res, {
      error: `unknown connection ID "${params.connection_id}"`,
    });
  }

  const tokenUrl = new URL(secretData.web.token_uri);
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("code", params.code);
  tokenUrl.searchParams.set(
    "redirect_uri",
    new URL(params.redirect_path, req.headers.origin).href
  );
  tokenUrl.searchParams.set("client_id", secretData.web.client_id);
  tokenUrl.searchParams.set("client_secret", secretData.web.client_secret);

  const httpRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  let tokenResponse: TokenEndpointGrantResponse;
  try {
    tokenResponse = (await httpRes.json()) as TokenEndpointGrantResponse;
  } catch (e) {
    console.error(
      `Could not read JSON response from grant token endpoint (status ${httpRes.status}): ${e}`
    );
    return internalServerError(
      res,
      `Could not read JSON response from grant token endpoint (status ${httpRes.status})`
    );
  }

  if (
    httpRes.status === 200 &&
    tokenResponse.error === undefined &&
    tokenResponse.access_token &&
    tokenResponse.refresh_token &&
    tokenResponse.expires_in >= 0
  ) {
    return okJson(res, {
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      refresh_token: tokenResponse.refresh_token,
    } satisfies GrantResponse);
  }

  if (httpRes.status === 400) {
    if (tokenResponse.error === "invalid_grant") {
      // The token is expired.
      return badRequestJson(res, {
        error: "invalid_grant",
      } satisfies GrantResponse);
    } else if (tokenResponse.error === "redirect_uri_mismatch") {
      // Our redirect URL is misconfigured somehow.
      return badRequestJson(res, {
        error: "redirect_uri_mismatch",
      } satisfies GrantResponse);
    }
  }

  console.error(
    `Unexpected HTTP ${httpRes.status} status from grant token endpoint ${tokenUrl}:
${JSON.stringify(tokenResponse, null, 2)}`
  );
  return internalServerError(
    res,
    `Unexpected HTTP ${httpRes.status} status from grant token endpoint.`
  );
}

type TokenEndpointGrantResponse =
  | {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      error?: undefined;
    }
  | {
      error: string;
    };
