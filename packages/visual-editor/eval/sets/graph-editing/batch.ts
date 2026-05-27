/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { graphEditingSession } from "../../graph-editing-eval.js";

graphEditingSession({
  name: "Batch Graph Editing",
  uploadToDrive: true,
  batch: {
    path: "intents.local.txt",
    concurrency: 1,
  },
});
