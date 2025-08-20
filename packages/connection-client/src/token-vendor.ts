/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConnectionEnvironment,
  GrantStore,
  ListConnectionsResponse,
  RefreshRequest,
  RefreshResponse,
  TokenGrant,
  TokenResult,
  ValidTokenResult,
} from "./types.js";

/**
 * If a token is going to expire in less than this many milliseconds, we treat
 * it as though it is already expired, since there might be a delay between
 * returning it from here and it actually getting used.
 */
const EXPIRY_THRESHOLD_MS = /* 1 minute */ 60_000;

/**
 * Provides access to authorization tokens stored in settings, and the ability
 * to refresh them if they are expired.
 *
 * There should typically be one instance of this class per Visual Editor, and
 * elements should discover it using the {@link tokenVendorContext} Lit
 * context, which should be provided by the top-level Visual Editor element.
 */
export class TokenVendorImpl {
  #store: GrantStore;
  #environment: ConnectionEnvironment;

  constructor(store: GrantStore, environment: ConnectionEnvironment) {
    this.#store = store;
    this.#environment = environment;
  }

  getToken(connectionId: string): TokenResult {
    const grantJsonString = this.#store.get(connectionId);
    if (grantJsonString === undefined) {
      return { state: "signedout" };
    }
    const grant = JSON.parse(grantJsonString) as TokenGrant;
    const usingLessSecureRefreshTokenStorage = !!grant.refresh_token;
    if (usingLessSecureRefreshTokenStorage) {
      // In July 2025, we switched from storing the refresh token in IndexedDB,
      // to storing it as an HttpOnly cookie, for better security. If we still
      // have one of these older refresh tokens, make the user sign in again to
      // switch to the new cookie approach.
      return { state: "signedout" };
    }
    const needsClientIdRepair = grant.client_id === undefined;
    if (grantIsExpired(grant) || needsClientIdRepair) {
      return {
        state: "expired",
        grant,
        refresh: (opts?: { signal?: AbortSignal }) =>
          this.#refresh(connectionId, grant, opts?.signal),
      };
    }
    return { state: "valid", grant };
  }

  async #refresh(
    connectionId: string,
    expiredGrant: TokenGrant,
    signal?: AbortSignal
  ): Promise<ValidTokenResult> {
    if (expiredGrant.client_id === undefined) {
      // We used to not store the client_id locally, but later discovered it's
      // helpful to store because it's needed for some APIs.
      expiredGrant = await this.#repairGrantWithMissingClientId(
        connectionId,
        expiredGrant
      );
    }

    const refreshUrl = new URL(
      "refresh",
      this.#environment.connectionServerUrl
    );
    refreshUrl.search = new URLSearchParams({
      connection_id: connectionId,
    } satisfies RefreshRequest).toString();

    const now = Date.now();
    const httpRes = await fetch(refreshUrl, {
      signal,
      credentials: "include",
    });
    if (!httpRes.ok) {
      throw new Error(
        `Failed to refresh token, status: ${httpRes.status} ${httpRes.statusText}`
      );
    }
    const jsonRes = (await httpRes.json()) as RefreshResponse;
    if (jsonRes.error !== undefined) {
      throw new Error(`Failed to refresh token, error: ${jsonRes.error}`);
    }

    const updatedGrant: TokenGrant = {
      client_id: expiredGrant.client_id,
      access_token: jsonRes.access_token,
      expires_in: jsonRes.expires_in,
      issue_time: now,
      id: expiredGrant.id,
      picture: expiredGrant.picture,
      name: expiredGrant.name,
      domain: expiredGrant.domain,
      scopes: expiredGrant.scopes,
    };
    await this.#store.set(connectionId, JSON.stringify(updatedGrant));
    return { state: "valid", grant: updatedGrant };
  }

  async #repairGrantWithMissingClientId(
    connectionId: string,
    grant: TokenGrant
  ): Promise<TokenGrant> {
    const httpRes = await fetch(
      new URL("list", this.#environment.connectionServerUrl),
      { credentials: "include" }
    );
    if (!httpRes.ok) {
      throw new Error(
        `HTTP ${httpRes.status} error calling list connections API ` +
          `while repairing a grant with missing client id.`
      );
    }
    let jsonRes: ListConnectionsResponse;
    try {
      jsonRes = await httpRes.json();
    } catch {
      throw new Error(
        `Error decoding JSON from list connections API ` +
          `while repairing a grant with missing client id.`
      );
    }
    for (const connection of jsonRes.connections) {
      if (connection.id === connectionId) {
        return {
          ...grant,
          client_id: connection.clientId,
        };
      }
    }
    throw new Error(
      `Could not find a connection with id ` +
        `"${connectionId}" from list connections API ` +
        `while repairing a grant with missing client id.`
    );
  }
}

function grantIsExpired(grant: TokenGrant): boolean {
  const expiresAt =
    /* absolute milliseconds */ grant.issue_time +
    /* relative seconds */ grant.expires_in * 1000;
  const expiresIn = expiresAt - /* unix milliseconds */ Date.now();
  return expiresIn <= EXPIRY_THRESHOLD_MS;
}
