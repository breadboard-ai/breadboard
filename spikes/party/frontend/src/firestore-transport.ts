// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Firestore transport — uses Cloud Firestore as the Yjs sync backend.
 *
 * Architecture:
 *   - Each Yjs update is written as a new document in
 *     `rooms/{roomId}/updates/{auto-id}` (append-only, no LWW contention).
 *   - An `onSnapshot` listener feeds incoming updates into Y.applyUpdate().
 *   - Awareness (presence, cursors) is handled via a separate
 *     `rooms/{roomId}/presence/{clientId}` subcollection.
 *
 * The Yjs CRDT handles merge semantics — Firestore is just a dumb pipe.
 */

import * as Y from "yjs";
import { initializeApp } from "firebase/app";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc as firestoreDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Bytes,
  query,
  orderBy,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import type { Transport, AwarenessLike } from "./transport.js";

export { createFirestoreTransport };

const ROOM = "party-default";

// ── Firestore Awareness ──────────────────────────────────────────

/**
 * FirestoreAwareness — a Firestore-backed implementation of the Yjs
 * awareness protocol.
 *
 * Instead of piggybacking on a WebSocket connection, each client writes
 * its awareness state to `rooms/{roomId}/presence/{clientId}` and
 * listens for changes via onSnapshot.
 *
 * The API surface matches what `party-presence`, `party-cursors`, and
 * `identity.ts` actually use.
 */
class FirestoreAwareness implements AwarenessLike {
  readonly clientID: number;

  #db: Firestore;
  #roomId: string;
  #states = new Map<number, Record<string, unknown>>();
  #localState: Record<string, unknown> = {};
  #listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  #unsubscribe: Unsubscribe | null = null;
  #heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(db: Firestore, roomId: string) {
    this.clientID = Math.floor(Math.random() * 2 ** 30);
    this.#db = db;
    this.#roomId = roomId;

    // Listen for presence changes.
    const presenceRef = collection(db, "rooms", roomId, "presence");
    this.#unsubscribe = onSnapshot(presenceRef, (snapshot) => {
      const changed: number[] = [];

      for (const change of snapshot.docChanges()) {
        const cId = parseInt(change.doc.id, 10);
        if (isNaN(cId)) continue;

        if (change.type === "removed") {
          this.#states.delete(cId);
          changed.push(cId);
        } else {
          const data = change.doc.data();
          // Unwrap the `state` field — we store the full awareness state there.
          const state = (data.state as Record<string, unknown>) ?? {};
          this.#states.set(cId, state);
          changed.push(cId);
        }
      }

      if (changed.length > 0) {
        this.#emit("change", [
          { added: [], updated: changed, removed: [] },
          "firestore",
        ]);
      }
    });

    // Heartbeat — touch presence doc every 15s so stale entries can be
    // detected. In production you'd use a TTL + Cloud Function cleanup.
    this.#heartbeatInterval = setInterval(() => {
      this.#publishLocal();
    }, 15_000);
  }

  getStates(): Map<number, Record<string, unknown>> {
    return this.#states;
  }

  getLocalState(): Record<string, unknown> | null {
    return this.#localState;
  }

  setLocalState(state: Record<string, unknown> | null): void {
    if (state === null) {
      this.#localState = {};
      this.#removePresence();
    } else {
      this.#localState = state;
      this.#publishLocal();
    }
  }

  setLocalStateField(field: string, value: unknown): void {
    this.#localState[field] = value;
    this.#publishLocal();
  }

  on(event: string, cb: (...args: unknown[]) => void): void {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(cb);
  }

  off(event: string, cb: (...args: unknown[]) => void): void {
    this.#listeners.get(event)?.delete(cb);
  }

  destroy(): void {
    this.#unsubscribe?.();
    if (this.#heartbeatInterval) clearInterval(this.#heartbeatInterval);
    this.#removePresence();
  }

  #emit(event: string, args: unknown[]): void {
    const set = this.#listeners.get(event);
    if (!set) return;
    for (const cb of set) cb(...args);
  }

  #publishLocal(): void {
    const ref = firestoreDoc(
      this.#db,
      "rooms",
      this.#roomId,
      "presence",
      String(this.clientID)
    );
    setDoc(ref, {
      state: this.#localState,
      updatedAt: serverTimestamp(),
    }).catch((err) => console.warn("Presence write failed:", err));
  }

  #removePresence(): void {
    const ref = firestoreDoc(
      this.#db,
      "rooms",
      this.#roomId,
      "presence",
      String(this.clientID)
    );
    deleteDoc(ref).catch((err) =>
      console.warn("Presence delete failed:", err)
    );
  }
}

// ── Firestore Transport ──────────────────────────────────────────

async function createFirestoreTransport(): Promise<Transport> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Firestore transport requires a .env.firestore file with your Firebase " +
        "project config. Copy .env.firestore.example and fill in the values."
    );
  }

  const app = initializeApp({
    projectId,
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo-key",
  });
  const db = getFirestore(app, import.meta.env.VITE_FIRESTORE_DATABASE ?? "(default)");

  const ydoc = new Y.Doc();
  const awareness = new FirestoreAwareness(db, ROOM);

  // Track our own writes so we can skip them in the snapshot listener.
  const pendingWrites = new Set<string>();

  // ── Outbound: Yjs updates → Firestore ──────────────────────────

  const updatesRef = collection(db, "rooms", ROOM, "updates");

  ydoc.on("update", (update: Uint8Array, origin: unknown) => {
    // Don't re-upload updates that came from Firestore.
    if (origin === "firestore") return;

    const id = crypto.randomUUID();
    pendingWrites.add(id);

    addDoc(updatesRef, {
      data: Bytes.fromUint8Array(update),
      clientId: awareness.clientID,
      localId: id,
      timestamp: serverTimestamp(),
    }).catch((err) => console.error("Failed to write Yjs update:", err));
  });

  // ── Inbound: Firestore → Yjs updates ──────────────────────────

  let connected = false;
  const statusListeners = new Set<(e: { status: string }) => void>();

  const emitStatus = (status: string) => {
    connected = status === "connected";
    for (const cb of statusListeners) cb({ status });
  };

  const updatesQuery = query(updatesRef, orderBy("timestamp", "asc"));

  const unsubUpdates = onSnapshot(
    updatesQuery,
    (snapshot) => {
      if (!connected) emitStatus("connected");

      for (const change of snapshot.docChanges()) {
        if (change.type !== "added") continue;

        const data = change.doc.data();

        // Skip our own writes.
        if (data.localId && pendingWrites.has(data.localId)) {
          pendingWrites.delete(data.localId);
          continue;
        }

        // Apply remote update.
        const bytes = data.data as Bytes;
        const update = bytes.toUint8Array();
        Y.applyUpdate(ydoc, update, "firestore");
      }
    },
    (err) => {
      console.error("Firestore snapshot error:", err);
      emitStatus("disconnected");
    }
  );

  // ── Cleanup ────────────────────────────────────────────────────

  window.addEventListener("beforeunload", () => {
    awareness.setLocalState(null);
  });

  return {
    doc: ydoc,
    awareness,
    get connected() {
      return connected;
    },
    on(event: "status", cb: (e: { status: string }) => void) {
      statusListeners.add(cb);
    },
    off(event: "status", cb: (e: { status: string }) => void) {
      statusListeners.delete(cb);
    },
    destroy() {
      unsubUpdates();
      awareness.destroy();
      ydoc.destroy();
    },
  };
}
