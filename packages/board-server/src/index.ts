/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { startServer } from "./server.js";

// Start the server
(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error("Failed to start the server", err);
    process.exit(1);  // Exit with a failure code
  }
})();
