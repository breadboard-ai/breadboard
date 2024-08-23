/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createAccount } from "../src/server/store.js"

if (process.argv.length !== 3) {
  console.error("Usage: create-account <username>");
  process.exit(1);
}


const username = process.argv[2];

const {api_key} = await createAccount(username!)

console.log(`Created account for ${username} with API key:\n${api_key}`);
