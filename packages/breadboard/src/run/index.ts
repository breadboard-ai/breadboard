/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LifecycleManager } from "./lifecycle.js";
import { ManagedRunState } from "../types.js";

export const createRunStateManager = (): ManagedRunState => {
  const lifecycle = new LifecycleManager();
  return {
    lifecycle() {
      return lifecycle;
    },
  };
};
