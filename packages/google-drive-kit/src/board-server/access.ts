/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";

export { getAccessToken };

async function getAccessToken(vendor: TokenVendor): Promise<string | null> {
  let token = vendor.getToken("$sign-in");
  if (token.state === "expired") {
    token = await token.refresh();
  }
  if (token.state == "valid") {
    return token.grant.access_token;
  } else if (token.state == "signedout") {
    return null;
  } else {
    throw new Error(`Unexpected token state: ${token.state}`);
  }
}