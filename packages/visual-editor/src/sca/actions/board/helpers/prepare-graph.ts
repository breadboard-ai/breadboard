/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  GraphIdentifier,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import type { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import {
  applyDefaultThemeInformationIfNonePresent,
  createAppPaletteIfNeeded,
} from "../../../../runtime/util.js";

/**
 * Options for graph preparation.
 */
export interface PrepareGraphOptions {
  /** Module ID to focus on (for imperative graphs) */
  moduleId?: ModuleIdentifier | null;
  /** Subgraph ID to focus on */
  subGraphId?: GraphIdentifier | null;
  /** Google Drive client for palette creation */
  googleDriveClient?: GoogleDriveClient;
}

/**
 * Result of graph preparation.
 */
export interface PrepareGraphResult {
  /** The prepared graph (modified in place) */
  graph: GraphDescriptor;
  /** The resolved module ID (may differ from input) */
  moduleId: ModuleIdentifier | null;
  /** The resolved subgraph ID (may differ from input) */
  subGraphId: GraphIdentifier | null;
}

/**
 * Validates and resolves a module ID against the graph's modules.
 *
 * @param graph The graph to check against
 * @param moduleId The module ID to validate
 * @returns The validated module ID, or null if invalid
 */
export function validateModuleId(
  graph: GraphDescriptor,
  moduleId: ModuleIdentifier | null | undefined
): ModuleIdentifier | null {
  // For imperative graphs, use the main module if no module specified
  let resolvedModuleId = moduleId ?? null;
  if (graph.main && !resolvedModuleId) {
    resolvedModuleId = graph.main;
  }

  // Confirm the module exists
  if (
    resolvedModuleId &&
    (!graph.modules || !graph.modules[resolvedModuleId])
  ) {
    return null;
  }

  return resolvedModuleId;
}

/**
 * Validates and resolves a subgraph ID against the graph's subgraphs.
 *
 * @param graph The graph to check against
 * @param subGraphId The subgraph ID to validate
 * @returns The validated subgraph ID, or null if invalid
 */
export function validateSubGraphId(
  graph: GraphDescriptor,
  subGraphId: GraphIdentifier | null | undefined
): GraphIdentifier | null {
  if (subGraphId && (!graph.graphs || !graph.graphs[subGraphId])) {
    return null;
  }
  return subGraphId ?? null;
}

/**
 * Renames the legacy "Main board" subgraph to a random UUID.
 * This is for backwards compatibility with older graphs.
 *
 * @param graph The graph to modify (mutated in place)
 */
export function renameLegacyMainBoard(graph: GraphDescriptor): void {
  if (graph.graphs?.["Main board"]) {
    graph.graphs[globalThis.crypto.randomUUID()] = graph.graphs["Main board"];
    delete graph.graphs["Main board"];
  }
}

/**
 * Prepares a loaded graph for use.
 *
 * This includes:
 * - Validating and resolving module/subgraph IDs
 * - Renaming legacy "Main board" subgraph
 * - Applying default theme information
 * - Creating app palette if needed
 *
 * @param graph The graph to prepare (modified in place)
 * @param options Preparation options
 * @returns The prepared graph with resolved module/subgraph IDs
 */
export async function prepareGraph(
  graph: GraphDescriptor,
  options: PrepareGraphOptions = {}
): Promise<PrepareGraphResult> {
  const { moduleId, subGraphId, googleDriveClient } = options;

  // Validate module and subgraph IDs
  const resolvedModuleId = validateModuleId(graph, moduleId);
  const resolvedSubGraphId = validateSubGraphId(graph, subGraphId);

  // Rename legacy "Main board" subgraph
  renameLegacyMainBoard(graph);

  // Apply theme defaults
  applyDefaultThemeInformationIfNonePresent(graph);

  // Create palette if needed
  if (googleDriveClient) {
    await createAppPaletteIfNeeded(graph, googleDriveClient);
  }

  return {
    graph,
    moduleId: resolvedModuleId,
    subGraphId: resolvedSubGraphId,
  };
}
