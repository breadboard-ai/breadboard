/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OPAL_BACKEND_API_PREFIX, Outcome } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { formatAgentError } from "../../utils/formatting/format-agent-error.js";

export { getSingletonPrefixCache };

const ENDPOINT = "/v1beta1/getSingletonPrefixCache";

type SingletonPrefixCacheRequest = {
  useMemory: boolean;
  useNotebookLM: boolean;
  useGoogleDrive: boolean;
};

type SingletonPrefixCacheResponse = {
  cachedContent?: { name: string };
  errorMessage?: string;
};

/**
 * Fetches a shared cached content resource from the backend.
 *
 * The backend maintains an in-memory cache of Gemini `cachedContents`
 * resources keyed by the flag combination. Multiple clients with the
 * same flags share a single resource — no per-client cache creation.
 *
 * @returns The cache resource name (e.g. `cachedContents/abc123`) on
 * success, or an error outcome.
 */
async function getSingletonPrefixCache(
  moduleArgs: A2ModuleArgs,
  flags: SingletonPrefixCacheRequest
): Promise<Outcome<string>> {
  const { fetchWithCreds, context } = moduleArgs;
  const url = new URL(ENDPOINT, OPAL_BACKEND_API_PREFIX);

  try {
    const response = await fetchWithCreds(url, {
      method: "POST",
      body: JSON.stringify(flags),
      signal: context.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      return err(
        `getSingletonPrefixCache failed (${response.status}): ${text}`
      );
    }
    const json = (await response.json()) as SingletonPrefixCacheResponse;
    if (json.errorMessage) {
      return err(`getSingletonPrefixCache: ${json.errorMessage}`);
    }
    if (!json.cachedContent?.name) {
      return err(
        `getSingletonPrefixCache: no cache name in response: ${JSON.stringify(json)}`
      );
    }
    return json.cachedContent.name;
  } catch (e) {
    return err(formatAgentError(e));
  }
}
