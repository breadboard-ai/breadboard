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
} from "../types.js";

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
    context.mutable.rebuild(edit.replacement);
    return {
      success: true,
      affectedModules: [],
      affectedNodes: [],
      affectedGraphs: [],
    };
  }
}
