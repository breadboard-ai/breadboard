/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeHandlers } from "./types.js";
import lambda from "./nodes/lambda.js";

export class Core {
  handlers: NodeHandlers;

  constructor() {
    this.handlers = {
      lambda,
    };
  }
}
