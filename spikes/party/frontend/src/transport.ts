// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Transport abstraction — defines the interface that both WebSocket and
 * Firestore transports implement.
 *
 * Consumers import from `sync.ts` (unchanged) which re-exports from here.
 */

import * as Y from "yjs";

export { createTransport, type Transport, type AwarenessLike };

/**
 * Minimal awareness interface — matches the subset of y-protocols Awareness
 * that consumers actually use (cursor tracking, presence).
 */
interface AwarenessLike {
  clientID: number;
  getStates(): Map<number, Record<string, unknown>>;
  getLocalState(): Record<string, unknown> | null;
  setLocalState(state: Record<string, unknown> | null): void;
  setLocalStateField(field: string, value: unknown): void;
  on(event: string, cb: (...args: unknown[]) => void): void;
  off(event: string, cb: (...args: unknown[]) => void): void;
}

interface Transport {
  doc: Y.Doc;
  awareness: AwarenessLike;
  on(event: "status", cb: (e: { status: string }) => void): void;
  off(event: "status", cb: (e: { status: string }) => void): void;
  connected: boolean;
  destroy(): void;
}

async function createTransport(): Promise<Transport> {
  const mode = import.meta.env.VITE_TRANSPORT ?? "websocket";

  if (mode === "firestore") {
    const { createFirestoreTransport } = await import(
      "./firestore-transport.js"
    );
    return createFirestoreTransport();
  }

  const { createWebSocketTransport } = await import("./ws-transport.js");
  return createWebSocketTransport();
}
