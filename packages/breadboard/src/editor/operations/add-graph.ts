/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperation,
  EditOperationContext,
  EditSpec,
  SingleEditResult,
} from "../types.js";

export { AddGraph };

class AddGraph implements EditOperation {
  do(edit: EditSpec, context: EditOperationContext): Promise<SingleEditResult> {
    if (edit.type !== "addgraph") {
      throw new Error(
        `Editor API integrity error: expected type "addgraph", received "${edit.type}" instead.`
      );
    }
    const { graph, inspector, store } = context;
    // Check to see if a graph by this id already exists
    // Check to see if this is a subgraph
    throw new Error("not implemented");
  }
}
