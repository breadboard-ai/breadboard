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
  return async (
    grant: GrantResponse
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    // When endpointUrl isn't supplied, allow everyone.
    if (!endpointUrl) return { ok: true };

    if ("error" in grant) return { ok: true };

    try {
      const result = (await (
        await fetch(new URL(`/v1beta1/checkAppAccess`, endpointUrl), {
          headers: {
            Authorization: `Bearer ${grant.access_token}`,
          },
        })
      ).json()) as AllowListCheckResponse;
      if (result.canAccess) {
        return { ok: true };
      }
    } catch (e) {
      return {
        ok: false,
        error: "Unable to verify product availability for the user",
      };
    }

    return {
      ok: false,
      error: "Unfortunately, our product is not available in your region",
    };
  };
}
