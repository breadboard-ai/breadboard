/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "@breadboard-ai/types";

export { RemoveIntegration };

class RemoveIntegration implements EditOperation {
  async do(
    spec: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (spec.type !== "removeintegration") {
      throw new Error(
        `Editor API integrity error: expected type "removeintegration", received "${spec.type}" instead.`
      );
    }

    const { id } = spec;

    const {
      graph: { integrations },
    } = context;

    let noChange = false;

    if (integrations?.[id]) {
      delete integrations[id];
      if (Object.keys(integrations).length === 0) {
        delete context.graph.integrations;
      }
    } else {
      noChange = true;
    }

    return {
      success: true,
      affectedGraphs: [],
      affectedModules: [],
      affectedNodes: [],
      integrationsChange: true,
      noChange,
    };
  }
}
