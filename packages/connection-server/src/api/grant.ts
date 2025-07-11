/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { jwtDecode, type JwtPayload } from "jwt-decode";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerConfig } from "../config.js";
import type { GrantResponse } from "@breadboard-ai/types/oauth.js";
import { badRequestJson, internalServerError, okJson } from "../responses.js";
import { oAuthRefreshTokenCookieId } from "./cookies.js";

export type TokenEndpointGrantResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
      refresh_token: string;
      id_token: string;
    };

interface GrantRequest {
  connection_id: string;
  code: string;
  redirect_path: string;
}

/**
 * API which performs first-time authorization for a connection.
 */
export async function grant(
  req: IncomingMessage,
  res: ServerResponse,
  config: ServerConfig
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

  const connectionConfig = config.connections.get(params.connection_id);
  if (!connectionConfig) {
    return badRequestJson(res, {
      error: `unknown connection ID "${params.connection_id}"`,
    });
  }

  const tokenUrl = new URL(connectionConfig.oauth.token_uri);
  const origin =
    req.headers.origin || inferOriginFromHostname(req.headers.host);
  const redirectUrl = new URL(params.redirect_path, origin).href;
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("code", params.code);
  tokenUrl.searchParams.set("redirect_uri", redirectUrl);
  tokenUrl.searchParams.set("client_id", connectionConfig.oauth.client_id);
  tokenUrl.searchParams.set(
    "client_secret",
    connectionConfig.oauth.client_secret
  );

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
    const { picture, name, id, domain } = decodeIdToken(tokenResponse.id_token);
    const grantResponse: GrantResponse = {
      access_token: tokenResponse.access_token,
      expires_in: tokenResponse.expires_in,
      picture,
      name,
      id,
      domain,
    };
    if (config.validateResponse) {
      const checkedGrantResponse = await config.validateResponse(grantResponse);
      if (!checkedGrantResponse.ok) {
        return badRequestJson(res, {
          error: checkedGrantResponse.error,
        });
      }
    }
    res.setHeader(
      "Set-Cookie",
      [
        `${oAuthRefreshTokenCookieId}=${tokenResponse.refresh_token}`,
        `HttpOnly`,
        `Max-Age=${365 * 24 * 60 * 60}`,
        `Path=/connection/refresh`,
        `SameSite=Strict`,
        `Secure`,
      ].join("; ")
    );
    return okJson(res, grantResponse);
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

/**
 * This is a gnarly workaround. When used within Express, the origin
 * request header is occasionally undefined, so we have to do something
 * to get the origin again.
 *
 * This code naively uses hostname to infer the origin.
 */
function inferOriginFromHostname(host?: string) {
  if (!host) throw new Error("Unable to infer origin: no host");
  return host.startsWith("localhost") ? `http://${host}` : `https://${host}`;
}

type DecodeIdTokenResponse = {
  picture?: string;
  name?: string;
  id?: string;
  domain?: string;
};

function decodeIdToken(id_token?: string): DecodeIdTokenResponse {
  if (!id_token) return {};
  try {
    const decoded = jwtDecode(id_token) as JwtPayload & {
      // https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters
      name?: string;
      picture?: string;
      hd?: string;
    };
    return {
      id: decoded.sub,
      name: decoded.name,
      picture: decoded.picture,
      domain: decoded.hd,
    };
  } catch (e) {
    return {};
  }
}
