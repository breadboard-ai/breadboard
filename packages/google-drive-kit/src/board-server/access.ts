/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";

export { getAccessToken };

async function getAccessToken(vendor: TokenVendor): Promise<string | null> {
  const token = vendor.getToken("$sign-in");
  if (token.state === "expired") {
    const refreshed = await token.refresh();
    return refreshed.grant.access_token;
  } else if (token.state == "signedout") {
    return null;
  }
  return token.grant.access_token;
}
