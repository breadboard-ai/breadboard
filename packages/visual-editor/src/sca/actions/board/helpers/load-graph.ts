/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  BoardServer,
  GraphLoader,
} from "@breadboard-ai/types";
import type { SigninAdapter } from "../../../../ui/utils/signin-adapter.js";
import { canParse, addResourceKeyIfPresent } from "./resolve-url.js";

export type { CanLoadResult, LoadGraphResult };

/**
 * Result type for canLoad check.
 */
type CanLoadResult =
  | { canLoad: true; urlWithResourceKey: string }
  | { canLoad: false; reason: "invalid-url" };

/**
 * Result type for loadGraph function.
 */
type LoadGraphResult =
  | { success: true; graph: GraphDescriptor; boardServer: BoardServer }
  | { success: false; reason: "invalid-url" | "auth-required" | "load-failed" };

/**
 * Checks if a URL can be loaded and prepares it with resource key if needed.
 *
 * @param url The URL to check
 * @param referenceUrl URL to extract resource key from (e.g., current browser URL)
 * @returns Whether the URL can be loaded and the prepared URL
 */
export function canLoad(
  url: string,
  referenceUrl: string | null
): CanLoadResult {
  // For absolute URLs, don't need a base. For relative URLs, use location.
  const base = globalThis.location?.href;

  // First check if it's a valid absolute URL
  if (!canParse(url) && !canParse(url, base)) {
    return { canLoad: false, reason: "invalid-url" };
  }

  const urlWithResourceKey = addResourceKeyIfPresent(url, referenceUrl);
  return { canLoad: true, urlWithResourceKey };
}

/**
 * Dependencies required by loadGraph.
 */
export interface LoadGraphDeps {
  loader: GraphLoader;
  signinAdapter: SigninAdapter;
  boardServer: BoardServer;
}

/**
 * Loads a graph from a URL.
 *
 * Handles:
 * - Resource key extraction from reference URL
 * - Loading via the provided loader
 * - Auth state checking when load fails
 *
 * @param url The URL to load the graph from
 * @param referenceUrl URL to extract resource key from
 * @param deps Required dependencies (loader, signinAdapter, boardServer)
 * @returns The loaded graph and board server, or an error result
 */
export async function loadGraph(
  url: string,
  referenceUrl: string | null,
  deps: LoadGraphDeps
): Promise<LoadGraphResult> {
  const { loader, signinAdapter, boardServer } = deps;

  // Check if URL is valid
  const canLoadResult = canLoad(url, referenceUrl);
  if (!canLoadResult.canLoad) {
    return { success: false, reason: canLoadResult.reason };
  }

  // Load the graph
  const loadResult = await loader.load(canLoadResult.urlWithResourceKey);

  if (!loadResult.success || !loadResult.graph) {
    // Check auth state to determine error type
    const authState = await signinAdapter.state;
    if (authState === "signedout") {
      return { success: false, reason: "auth-required" };
    }

    return { success: false, reason: "load-failed" };
  }

  return {
    success: true,
    graph: loadResult.graph,
    boardServer,
  };
}
