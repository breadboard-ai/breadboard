/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GrantResponse } from "@breadboard-ai/types/oauth.js";

import * as flags from "./flags.js";

export { allowListChecker };

type AllowListCheckResponse = {
  canAccess: boolean;
};

function allowListChecker() {
  return async (
    grant: GrantResponse
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    // When BACKEND_API_ENDPOINT isn't supplied, allow everyone.
    if (!flags.BACKEND_API_ENDPOINT) {
      return { ok: true };
    }
    if ("error" in grant) {
      return { ok: true };
    }

    const endpointUrl = new URL(flags.BACKEND_API_ENDPOINT);
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
