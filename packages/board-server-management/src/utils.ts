/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenVendor } from "@breadboard-ai/connection-client";

const SIGN_IN_CONNECTION_ID = "$sign-in";

export { getSigninToken };

async function getSigninToken(
  tokenVendor?: TokenVendor
): Promise<string | undefined> {
  if (!tokenVendor) return;

  let token = tokenVendor.getToken(SIGN_IN_CONNECTION_ID);
  if (!token || token.state === "signedout") {
    return;
  }

  if (token.state === "expired") {
    token = await token.refresh();
  }

  return token.grant.access_token;
}
