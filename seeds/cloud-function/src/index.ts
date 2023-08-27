/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { http } from "@google-cloud/functions-framework";

// Register an HTTP function with the Functions Framework
http("hello", (req, res) => {
  // Your code here

  // Send an HTTP response
  res.send("world");
});
