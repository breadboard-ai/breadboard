/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GrantResponse } from "@breadboard-ai/connection-server";

export { allowListChecker };

type AllowListCheckResponse = {
  canAccess: boolean;
};

function allowListChecker(endpointUrl: URL | "" | undefined) {
  return async (grant: GrantResponse): Promise<GrantResponse> => {
    // When endpointUrl isn't supplied, allow everyone.
    if (!endpointUrl) return grant;

    if ("error" in grant) return grant;

    try {
      const result = (await (
        await fetch(new URL(`/v1beta1/checkAppAccess`, endpointUrl), {
          headers: {
            Authorization: `Bearer ${grant.access_token}`,
          },
        })
      ).json()) as AllowListCheckResponse;
      if (result.canAccess) {
        return grant;
      }
    } catch (e) {
      return { error: "Unable to verify product availablilty for the user" };
    }

    return {
      error: "Unfortunately, our product is not available in your region",
    };
  };
}
