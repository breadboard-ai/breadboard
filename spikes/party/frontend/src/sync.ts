// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Yjs sync — barrel module.
 *
 * Initializes the selected transport (WebSocket or Firestore) and
 * re-exports `doc`, `provider`, and `awareness` so all existing
 * consumers work without changes.
 *
 * Uses top-level await to resolve the async transport factory before
 * any consumer accesses the exports.
 */

import { createTransport } from "./transport.js";

export { doc, provider, awareness };

const provider = await createTransport();
const { doc, awareness } = provider;
