/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerResponse } from "node:http";
import type { ServerConfig } from "../config.js";
import { badRequestJson, internalServerError, okJson } from "../responses.js";
import type { Request } from "express";
import * as cookies from "./cookies.js";

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
  req: Request,
  res: ServerResponse,
  config: ServerConfig
): Promise<void> {
  const refreshToken = req.cookies[cookies.REFRESH_TOKEN];
  if (!refreshToken) {
    return badRequestJson(
      res,
      { error: `missing cookie: ${cookies.REFRESH_TOKEN}` },
      { httpStatusCode: 401 }
    );
  }

  const connectionConfig = config.connection;
  const tokenUrl = new URL(connectionConfig.oauth.token_uri);
  tokenUrl.searchParams.set("grant_type", "refresh_token");
  tokenUrl.searchParams.set("refresh_token", refreshToken);
  tokenUrl.searchParams.set("client_id", connectionConfig.oauth.client_id);
  tokenUrl.searchParams.set(
    "client_secret",
    connectionConfig.oauth.client_secret ?? ""
  );

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
