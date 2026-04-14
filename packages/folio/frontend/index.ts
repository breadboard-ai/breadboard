/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as SCA from "./sca/sca.js";

console.log(SCA);

async function fetchBlocks() {
  try {
    const response = await fetch("/folio/blocks");
    const data = await response.json();
    console.log("Fetched blocks:", data);
  } catch (e) {
    console.error("Failed to fetch blocks:", e);
  }
}

fetchBlocks();
