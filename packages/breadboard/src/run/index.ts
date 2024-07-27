/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StackManager } from "../stack.js";
import { ManagedRunState } from "../types.js";

export const createRunStateManager = (): ManagedRunState => {
  const lifecycle = new StackManager();
  return {
    lifecycle() {
      return lifecycle;
    },
  };
};
