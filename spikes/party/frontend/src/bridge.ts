// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * CollabBridge — generic CRDT ↔ iframe bridge.
 *
 * Given a context shape (like an XState machine's initial context), this
 * class automatically:
 *
 *  1. Creates matching Yjs types (Y.Array for arrays, Y.Map fields for
 *     scalars, nested Y.Map for objects)
 *  2. Observes all changes and pushes serialized state to the iframe
 *  3. Handles `ark.mutate(path, op, value)` calls from the iframe and
 *     applies them to the correct Yjs type
 *  4. Forwards tracker events (cursor, click, selection) to awareness
 *
 * The bridge knows NOTHING about the domain (party, todo, dashboard).
 * It derives everything from the context shape at construction time.
 *
 * ## Mutation Protocol
 *
 * The iframe calls `ark.mutate(path, op, value)`:
 *
 *   ark.mutate("guests", "push", { name: "Kathy" })   → Y.Array push
 *   ark.mutate("guests", "delete", 2)                  → Y.Array delete at index
 *   ark.mutate("tasks.0.done", "set", true)             → Y.Map set on array item
 *   ark.mutate("notes", "set", "new text")              → root Y.Map set (scalar)
 */

import { doc, awareness } from "./sync.js";
import { getIdentity } from "./identity.js";
import * as Y from "yjs";

export { CollabBridge };

// ── Types ─────────────────────────────────────────────────────────

type ContextShape = Record<string, unknown>;

interface TrackerEvent {
  event: "cursor" | "click" | "selection";
  [key: string]: unknown;
}

// ── Bridge ────────────────────────────────────────────────────────

class CollabBridge {
  #iframe: HTMLIFrameElement;
  #ready = false;
  #pendingProps: Record<string, unknown> | null = null;
  #root: Y.Map<unknown>;

  /**
   * @param iframe  The iframe element hosting the React app.
   * @param context The initial context shape — arrays become Y.Arrays,
   *                scalars become Y.Map fields, objects become nested Y.Maps.
   */
  constructor(iframe: HTMLIFrameElement, context: ContextShape) {
    this.#iframe = iframe;
    this.#root = doc.getMap("state");

    // Initialize CRDT structure from context shape (only if empty).
    this.#initFromContext(context);

    // One observer for everything.
    this.#root.observeDeep(this.#pushState);

    // Listen for messages from the iframe.
    window.addEventListener("message", this.#handleMessage);
  }

  destroy() {
    this.#root.unobserveDeep(this.#pushState);
    window.removeEventListener("message", this.#handleMessage);
  }

  // ── Context → CRDT initialization ──────────────────────────────

  /**
   * Walk the context shape and create matching Yjs types.
   *
   * Only initializes if the root map is empty (first client to connect
   * seeds the structure; subsequent clients inherit via CRDT sync).
   */
  #initFromContext(context: ContextShape) {
    if (this.#root.size > 0) return; // Already seeded.

    doc.transact(() => {
      for (const [key, value] of Object.entries(context)) {
        if (Array.isArray(value)) {
          // Array → Y.Array (items will be Y.Maps when pushed).
          this.#root.set(key, new Y.Array());
        } else if (typeof value === "object" && value !== null) {
          // Object → nested Y.Map.
          const ymap = new Y.Map();
          for (const [k, v] of Object.entries(value)) {
            ymap.set(k, v);
          }
          this.#root.set(key, ymap);
        } else {
          // Scalar (string, number, boolean) → direct value.
          this.#root.set(key, value);
        }
      }
    });
  }

  // ── State projection (CRDT → props) ────────────────────────────

  /**
   * Recursively serialize the CRDT state tree to plain JS.
   */
  #serialize(ytype: unknown): unknown {
    if (ytype instanceof Y.Map) {
      const obj: Record<string, unknown> = {};
      for (const [key, value] of ytype.entries()) {
        obj[key] = this.#serialize(value);
      }
      return obj;
    }
    if (ytype instanceof Y.Array) {
      return ytype.toArray().map((item) => this.#serialize(item));
    }
    if (ytype instanceof Y.Text) {
      return ytype.toString();
    }
    // Scalar — return as-is.
    return ytype;
  }

  #serializeState(): Record<string, unknown> {
    const identity = getIdentity();
    const state = this.#serialize(this.#root) as Record<string, unknown>;
    // Inject identity — always available as a prop, derived from
    // the parent frame's identity system, not from CRDT state.
    state.identity = identity
      ? { name: identity.name, color: identity.color }
      : {};
    return state;
  }

  #pushState = () => {
    const props = this.#serializeState();

    // Sync the theme CSS vars on the parent frame so parent-frame UI
    // (prompt overlay, FAB, etc.) matches the active theme.
    const theme = props.theme as string;
    if (theme) {
      CollabBridge.#applyThemeToParent(theme);
    }

    if (!this.#ready) {
      this.#pendingProps = props;
      return;
    }

    this.#iframe.contentWindow?.postMessage(
      { type: "update-props", props },
      "*"
    );
  };

  /** Theme definitions (mirrors App.jsx — shared for parent-frame sync). */
  static #THEMES: Record<string, Record<string, string>> = {
    midnight: {
      bg: "#0f0f13", surface: "#1a1a24", surfaceAlt: "#22222e",
      border: "#2e2e3e", text: "#e8e8f0", textMuted: "#8888a0",
      accent: "#7c6cff", accentGlow: "rgba(124, 108, 255, 0.2)", success: "#34d399",
    },
    ocean: {
      bg: "#0a1628", surface: "#0f2240", surfaceAlt: "#152a4a",
      border: "#1e3a5f", text: "#e0f0ff", textMuted: "#7ba8d0",
      accent: "#38bdf8", accentGlow: "rgba(56, 189, 248, 0.2)", success: "#22d3ee",
    },
    neon: {
      bg: "#0a0a0f", surface: "#12121f", surfaceAlt: "#1a1a2e",
      border: "#2a2a4a", text: "#f0f0ff", textMuted: "#9090b8",
      accent: "#ff2eaa", accentGlow: "rgba(255, 46, 170, 0.2)", success: "#00ff88",
    },
    forest: {
      bg: "#0a120e", surface: "#121f18", surfaceAlt: "#1a2a22",
      border: "#2a3e32", text: "#e0f0e8", textMuted: "#7aaa8e",
      accent: "#10b981", accentGlow: "rgba(16, 185, 129, 0.2)", success: "#34d399",
    },
  };

  static #applyThemeToParent(themeId: string) {
    const theme = CollabBridge.#THEMES[themeId] ?? CollabBridge.#THEMES.midnight;
    const root = document.documentElement;
    const vars: Record<string, string> = {
      "--color-bg": theme.bg, "--color-surface": theme.surface,
      "--color-surface-alt": theme.surfaceAlt, "--color-border": theme.border,
      "--color-text": theme.text, "--color-text-muted": theme.textMuted,
      "--color-accent": theme.accent, "--color-accent-glow": theme.accentGlow,
      "--color-success": theme.success,
    };
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }
  }

  // ── Message handling (iframe → host) ────────────────────────────

  #handleMessage = (e: MessageEvent) => {
    if (e.source !== this.#iframe.contentWindow) return;

    const { data } = e;
    if (!data || !data.type) return;

    switch (data.type) {
      case "ready":
        this.#onReady();
        break;
      case "mutate":
        this.#handleMutate(data.path, data.op, data.value);
        break;
      case "tracker":
        this.#handleTracker(data as TrackerEvent);
        break;
    }
  };

  #onReady() {
    this.#ready = true;
    const props = this.#pendingProps ?? this.#serializeState();
    this.#pendingProps = null;
    this.#iframe.contentWindow?.postMessage(
      { type: "render", props },
      "*"
    );
  }

  // ── Mutation handling (path-resolved CRDT operations) ───────────

  /**
   * Resolve a dotted path and apply an operation.
   *
   * Supported ops:
   *   - "push"   — append to Y.Array (value becomes a Y.Map)
   *   - "delete" — remove from Y.Array at index (value = index)
   *   - "set"    — set a field on Y.Map or a scalar on root
   *
   * Path examples:
   *   "guests"        → root.get("guests")        (Y.Array)
   *   "tasks.0.done"  → root.get("tasks").get(0)   (Y.Map) .set("done", ...)
   *   "theme"         → root                       .set("theme", ...)
   */
  #handleMutate(path: string, op: string, value: unknown) {
    const segments = path.split(".");
    const lastSegment = segments[segments.length - 1];

    // Single-segment path: operate directly on the root map.
    if (segments.length === 1) {
      const existing = this.#root.get(lastSegment);

      // If the value at this key is a Y.Array, delegate to array ops.
      if (existing instanceof Y.Array) {
        this.#applyArrayOp(existing, op, value);
        return;
      }

      // Otherwise it's a scalar — set directly on root.
      if (op === "set") {
        this.#root.set(lastSegment, value);
      }
      return;
    }

    // Multi-segment path: resolve to the parent, then apply.
    const parent = this.#resolve(segments.slice(0, -1));

    if (parent instanceof Y.Map) {
      if (op === "set") {
        parent.set(lastSegment, value);
      }
    } else if (parent instanceof Y.Array) {
      // e.g. "tasks.0" — not typical but supported.
      this.#applyArrayOp(parent, op, value);
    }
  }

  #applyArrayOp(target: Y.Array<unknown>, op: string, value: unknown) {
    switch (op) {
      case "push": {
        // Value is a plain object → wrap in Y.Map.
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const ymap = new Y.Map();
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            ymap.set(k, v);
          }
          target.push([ymap]);
        } else {
          target.push([value]);
        }
        break;
      }
      case "delete": {
        const index = typeof value === "number" ? value : 0;
        if (index >= 0 && index < target.length) {
          target.delete(index);
        }
        break;
      }
    }
  }

  /**
   * Walk dotted path segments to resolve a Yjs type.
   *
   *   ["tasks", "0"] → root.get("tasks").get(0)
   *   []             → root
   */
  #resolve(segments: string[]): unknown {
    let current: unknown = this.#root;
    for (const seg of segments) {
      if (current instanceof Y.Map) {
        current = current.get(seg);
      } else if (current instanceof Y.Array) {
        const index = parseInt(seg, 10);
        current = current.get(index);
      } else {
        return undefined;
      }
    }
    return current;
  }

  // ── Tracker handling ────────────────────────────────────────────

  #handleTracker(data: TrackerEvent) {
    const identity = getIdentity();
    if (!identity) return;

    switch (data.event) {
      case "cursor":
        awareness.setLocalStateField("cursor", {
          x: data.x,
          y: data.y,
        });
        break;
      case "click":
        awareness.setLocalStateField("click", {
          x: data.x,
          y: data.y,
          t: data.t,
        });
        break;
      case "selection":
        awareness.setLocalStateField("selection", {
          collapsed: data.collapsed,
          rects: data.rects,
        });
        break;
    }
  }
}
