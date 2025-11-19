/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const OAUTH_POPUP_MESSAGE_TYPE = "oauth-popup-message";

export type OAuthPopupMessage = {
  type: typeof OAUTH_POPUP_MESSAGE_TYPE;
  nonce: string;
  grantResponse: GrantResponse;
};

export type GrantResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
      picture?: string;
      name?: string;
      id?: string;
      /**
       * Also known as the "hd" parameter, see
       * https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters
       */
      domain?: string;
      scopes?: string[];
    };

export type RefreshResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
    };

export interface TokenGrant {
  client_id: string;
  access_token: string;
  expires_in: number;
  /**
   * @deprecated since July 2025 in favor of HttpOnly cookie. Should only be
   * used to detect when an upgrade to the new cookie is required.
   */
  refresh_token?: string;
  issue_time: number;
  picture?: string;
  name?: string;
  id?: string;
  domain: string | undefined;
  scopes: string[] | undefined;
}

export type TokenResult =
  | ValidTokenResult
  | ExpiredTokenResult
  | MissingScopesTokenResult
  | SignedOutTokenResult;

/**
 * The token is valid and ready to be used.
 */
export interface ValidTokenResult {
  state: "valid";
  grant: TokenGrant;
}

/**
 * The user is signed-in to this service, but the token we have is expired. Call
 * the `refresh` method to automatically refresh it.
 */
export interface ExpiredTokenResult {
  state: "expired";
  grant: TokenGrant;
  refresh: (opts?: {
    signal?: AbortSignal;
  }) => Promise<ValidTokenResult | SignedOutTokenResult>;
}

export interface MissingScopesTokenResult {
  state: "missing-scopes";
  scopes: string[];
}

/**
 * The user is not signed-in to this service. In this case, typically a
 * `<bb-connection-signin>` element should be displayed to prompt the user to
 * sign-in.
 */
export interface SignedOutTokenResult {
  state: "signedout";
}
