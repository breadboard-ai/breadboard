/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";

export function startServer(port: number) {
  const app = express();

  app.listen(port, () => {
    console.info(`[unified-server] Listening on port ${port}`);
  });
}
