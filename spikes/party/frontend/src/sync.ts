// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Yjs document + WebSocket provider setup.
 *
 * Shared across all components — import `doc`, `provider`, and `awareness`
 * from here.
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export { doc, provider, awareness };

/** The room name. All tabs with the same room share state. */
const ROOM = "party-default";
const WS_URL = "ws://localhost:4444";

const doc = new Y.Doc();

const provider = new WebsocketProvider(WS_URL, ROOM, doc);

const awareness = provider.awareness;

/**
 * Clean up presence on tab close / navigation.
 *
 * Without this, the awareness entry lingers for ~30 seconds after the tab
 * is closed. Explicitly clearing it gives instant feedback in other tabs.
 */
window.addEventListener("beforeunload", () => {
  awareness.setLocalState(null);
  provider.disconnect();
});
