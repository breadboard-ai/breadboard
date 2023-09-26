/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const worker = new Worker("/src/worker.ts", { type: "module" });

worker.onmessage = (message) => {
  console.log("from worker", message);
};
