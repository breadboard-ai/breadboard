/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Config } from "../config.js";
import { badRequestJson, internalServerError, okJson } from "../responses.js";

// IMPORTANT: Keep in sync with
// breadboard/packages/breadboard-ui/src/elements/connection/connection-input.ts
interface RefreshRequest {
  connection_id: string;
  refresh_token: string;
}

type RefreshResponse =
  | { error: string }
  | {
      error?: string;
      access_token: string;
      expires_in: number;
    };

/**
 * API which gets a new authorization token for when an earlier one has expired.
 */
export async function refresh(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config
): Promise<void> {
  const params = Object.fromEntries(
    new URL(req.url ?? "", "http://example.com").searchParams.entries()
  ) as object as RefreshRequest;
  if (!params.connection_id) {
    return badRequestJson(res, { error: "missing connection_id" });
  }
  if (!params.refresh_token) {
    return badRequestJson(res, { error: "missing refresh_token" });
  }

  const secretData = config.secrets.get(params.connection_id);
  if (!secretData) {
    return badRequestJson(res, {
      error: `unknown connection ID "${params.connection_id}"`,
    });
  }

  const tokenUrl = new URL(secretData.web.token_uri);
  tokenUrl.searchParams.set("grant_type", "refresh_token");
  tokenUrl.searchParams.set("refresh_token", params.refresh_token);
  tokenUrl.searchParams.set("client_id", secretData.web.client_id);
  tokenUrl.searchParams.set("client_secret", secretData.web.client_secret);

  const httpRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  let tokenResponse: TokenEndpointRefreshResponse;
  try {
    tokenResponse = (await httpRes.json()) as TokenEndpointRefreshResponse;
  } catch (e) {
    console.error(
      `Could not read JSON response from refresh token endpoint (status ${httpRes.status}): ${e}`
    );
    return internalServerError(
      res,
      `Could not read JSON response from refresh token endpoint (status ${httpRes.status})`
    );
  }

  if (
    httpRes.status === 200 &&
    tokenResponse.error === undefined &&
    tokenResponse.access_token &&
    tokenResponse.expires_in >= 0
  ) {
    return okJson(res, {
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
    } satisfies RefreshResponse);
  }

  console.error(
    `Unexpected HTTP ${httpRes.status} status from refresh token endpoint endpoint ${tokenUrl}:
${JSON.stringify(tokenResponse, null, 2)}`
  );
  return internalServerError(
    res,
    `Unexpected HTTP ${httpRes.status} status from refresh token endpoint endpoint.`
  );
}

type TokenEndpointRefreshResponse =
  | {
      access_token: string;
      expires_in: number;
      error?: undefined;
    }
  | {
      error: string;
    };
