/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
} from "@google-labs/breadboard";

export { MarkInPortsInvalid };

class MarkInPortsInvalid implements EditTransform {
  constructor(public readonly graphId: GraphIdentifier) {}

  async apply(_context: EditOperationContext): Promise<EditTransformResult> {
    return { success: true };
  }
}
