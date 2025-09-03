/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "@breadboard-ai/types";

export { UpsertInteration };

class UpsertInteration implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "upsertintegration") {
      throw new Error(
        `Editor API integrity error: expected type "upsertintegration", received "${spec.type}" instead.`
      );
    }

    const { id, integration } = spec;

    const { graph } = context;

    graph.integrations ??= {};
    graph.integrations[id] = integration;

    return {
      success: true,
      affectedGraphs: [],
      affectedModules: [],
      affectedNodes: [],
      integrationsChange: true,
    };
  }
}
