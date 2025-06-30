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

export class ReplaceGraph implements EditOperation {
  async do(
    edit: EditSpec,
    context: EditOperationContext
  ): Promise<SingleEditResult> {
    if (edit.type !== "replacegraph") {
      throw new Error(
        `Editor API integrity error: expected type "replacegraph", received "${edit.type}" instead.`
      );
    }

    // Do a full in-place replacement of the graph. Re-assigning onto context
    // won't work because the object itself is captured and used elsewhere.
    const originalUrl = context.graph.url;
    for (const key in context.graph) {
      if (Object.prototype.hasOwnProperty.call(context.graph, key)) {
        delete context.graph[key as keyof typeof context.graph];
      }
    }
    Object.assign(context.graph, edit.replacement);
    // Ensure the URL doesn't change; it's very important.
    context.graph.url = originalUrl;

    // Also update the "mutable" graph, which is actually a bunch of caches for
    // the UI that are not automatically synchronized with the actual graph.
    context.mutable.rebuild(edit.replacement);

    return {
      success: true,
      // We don't need to include any affected things, because rebuild replaces
      // them anyway.
      affectedModules: [],
      affectedNodes: [],
      affectedGraphs: [],
    };
  }
}
