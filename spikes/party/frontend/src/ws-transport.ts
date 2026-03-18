// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * WebSocket transport — wraps y-websocket as a Transport implementation.
 *
 * This is the original sync logic from the spike, extracted into the
 * Transport interface shape.
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { Transport, AwarenessLike } from "./transport.js";

export { createWebSocketTransport };

const ROOM = "party-default";
const WS_URL = "ws://localhost:4444";

function createWebSocketTransport(): Transport {
  const doc = new Y.Doc();
  const wsProvider = new WebsocketProvider(WS_URL, ROOM, doc);
  const awareness = wsProvider.awareness as unknown as AwarenessLike;

  const statusListeners = new Set<(e: { status: string }) => void>();

  wsProvider.on("status", (event: { status: string }) => {
    for (const cb of statusListeners) cb(event);
  });

  window.addEventListener("beforeunload", () => {
    awareness.setLocalState(null);
    wsProvider.disconnect();
  });

  return {
    doc,
    awareness,
    get connected() {
      return wsProvider.wsconnected;
    },
    on(event: "status", cb: (e: { status: string }) => void) {
      statusListeners.add(cb);
    },
    off(event: "status", cb: (e: { status: string }) => void) {
      statusListeners.delete(cb);
    },
    destroy() {
      awareness.setLocalState(null);
      wsProvider.disconnect();
      wsProvider.destroy();
    },
  };
}
