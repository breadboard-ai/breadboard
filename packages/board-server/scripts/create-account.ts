/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createAccount } from "./accounts";

const username = process.argv[2];
if (!username) {
  console.error("Usage: create-account <username>");
  process.exit(1);
}

createAccount(username);
