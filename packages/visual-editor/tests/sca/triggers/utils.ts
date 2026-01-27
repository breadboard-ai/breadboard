/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppController } from "../../../src/sca/controller/controller.js";

const defaultGraph = {
  version: 0,
  graphIsMine: true,
};

export function makeTestController(graph = defaultGraph): AppController {
  return {
    editor: {
      graph,
    },
    global: {
      debug: {
        enabled: true,
      },
    },
  } as AppController;
}
