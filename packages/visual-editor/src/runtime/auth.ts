/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenGrant, TokenVendor } from "@breadboard-ai/connection-client";

export { SigninManager };

const SIGN_IN_CONNECTION_ID = "$sign-in";

/**
 * The three states are:
 *
 * - "signedout" -- the user is not yet signed in or has signed out, but the
 *                  runtime is configured to use sign in.
 * - "valid" -- the user is currently signed in.
 * - "anonymous" -- the runtime is not configured to use the sign in.
 */
export type SigninState = "signedout" | "valid" | "anonymous";

class SigninManager {
  readonly state: SigninState;
  readonly picture?: string;
  readonly id?: string;
  readonly name?: string;

  constructor(state: SigninState, grant?: TokenGrant) {
    this.state = state;
    this.picture = grant?.picture;
    this.id = grant?.id;
    this.name = grant?.name;
  }

  static async create(tokenVendor?: TokenVendor) {
    if (!tokenVendor) {
      return new SigninManager("anonymous");
    }
    const token = tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
    const { state } = token;
    if (state === "signedout") {
      return new SigninManager(state);
    }
    let grant: TokenGrant;
    if (state === "expired") {
      const refreshed = await token.refresh();
      grant = refreshed.grant;
    } else {
      grant = token.grant;
    }

    if (!grant.id || !grant.name || !grant.picture) {
      return new SigninManager("anonymous");
    }

    return new SigninManager("valid", grant);
  }
}
