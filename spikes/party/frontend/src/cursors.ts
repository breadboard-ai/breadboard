// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Remote cursor overlay — Figma-style cursor tracking with name tags,
 * click ripple animations, and selection highlights.
 *
 * Renders in the PARENT frame, positioned over the iframe. Cursor
 * coordinates from the tracker arrive in iframe-viewport space and are
 * translated to parent-frame space using the iframe's bounding rect.
 *
 * Uses requestAnimationFrame lerping for smooth cursor movement that
 * decouples rendering from the WebSocket/awareness update rate.
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { awareness } from "./sync.js";

interface CursorTarget {
  clientId: number;
  name: string;
  color: string;
  // Current rendered position (lerped).
  x: number;
  y: number;
  // Target position from latest awareness update.
  tx: number;
  ty: number;
}

interface ClickRipple {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface SelectionHighlight {
  clientId: number;
  color: string;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
}

let rippleIdCounter = 0;

/** Lerp factor — higher = snappier, lower = smoother. */
const LERP = 0.25;
/** Epsilon — stop lerping when close enough. */
const EPSILON = 0.5;

@customElement("party-cursors")
export class PartyCursors extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    }

    .cursor {
      position: absolute;
      will-change: transform;
    }

    .cursor svg {
      width: 16px;
      height: 20px;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
    }

    .cursor .label {
      position: absolute;
      left: 14px;
      top: 16px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      font-family: "Inter", system-ui, sans-serif;
      white-space: nowrap;
      color: white;
      line-height: 1.4;
    }

    /* ── Click ripple ──────────────────────────────────────── */

    .ripple {
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, -50%);
    }

    .ripple .ring {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid currentColor;
      animation: ripple-expand 600ms ease-out forwards;
    }

    .ripple .dot {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      transform: translate(-50%, -50%);
      animation: ripple-dot 400ms ease-out forwards;
    }

    @keyframes ripple-expand {
      0% { transform: scale(0.3); opacity: 1; }
      100% { transform: scale(2); opacity: 0; }
    }

    @keyframes ripple-dot {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    }

    /* ── Selection highlights ──────────────────────────────── */

    .selection-rect {
      position: absolute;
      opacity: 0.25;
      border-radius: 2px;
    }
  `;

  @state() private cursors: CursorTarget[] = [];
  @state() private ripples: ClickRipple[] = [];
  @state() private selections: SelectionHighlight[] = [];

  private localClientId = awareness.clientID;
  private lastClickTimestamps = new Map<number, number>();
  private cursorMap = new Map<number, CursorTarget>();
  private animFrameId = 0;
  private needsLerp = false;

  connectedCallback() {
    super.connectedCallback();
    awareness.on("change", this.#handleAwarenessChange);
    this.#startLerpLoop();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    awareness.off("change", this.#handleAwarenessChange);
    cancelAnimationFrame(this.animFrameId);
  }

  #getIframeOffset(): { x: number; y: number } {
    const host = document.querySelector("party-app");
    const iframe = host?.shadowRoot?.querySelector("iframe");
    if (!iframe) return { x: 0, y: 0 };
    const rect = iframe.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  #handleAwarenessChange = () => {
    const states = awareness.getStates() as Map<
      number,
      {
        user?: { name: string; color: string };
        cursor?: { x: number; y: number };
        click?: { x: number; y: number; t: number };
        selection?: {
          collapsed: boolean;
          rects: Array<{ x: number; y: number; width: number; height: number }>;
        };
      }
    >;

    const offset = this.#getIframeOffset();
    const activeIds = new Set<number>();
    const selectionResult: SelectionHighlight[] = [];

    for (const [clientId, state] of states) {
      if (clientId === this.localClientId) continue;

      if (state.user && state.cursor) {
        activeIds.add(clientId);
        const tx = state.cursor.x + offset.x;
        const ty = state.cursor.y + offset.y;

        const existing = this.cursorMap.get(clientId);
        if (existing) {
          // Update target — lerp loop will animate toward it.
          existing.tx = tx;
          existing.ty = ty;
          existing.name = state.user.name;
          existing.color = state.user.color;
        } else {
          // New cursor — snap to position immediately.
          const cursor: CursorTarget = {
            clientId,
            name: state.user.name,
            color: state.user.color,
            x: tx, y: ty,
            tx, ty,
          };
          this.cursorMap.set(clientId, cursor);
        }
        this.needsLerp = true;
      }

      // Check for new clicks.
      if (state.user && state.click) {
        const lastT = this.lastClickTimestamps.get(clientId) ?? 0;
        if (state.click.t > lastT) {
          this.lastClickTimestamps.set(clientId, state.click.t);
          this.#spawnRipple(
            state.click.x + offset.x,
            state.click.y + offset.y,
            state.user.color
          );
        }
      }

      // Selection highlights.
      if (state.user && state.selection && !state.selection.collapsed && state.selection.rects.length > 0) {
        selectionResult.push({
          clientId,
          color: state.user.color,
          rects: state.selection.rects.map((r) => ({
            x: r.x + offset.x,
            y: r.y + offset.y,
            width: r.width,
            height: r.height,
          })),
        });
      }
    }

    // Remove cursors for disconnected clients.
    for (const id of this.cursorMap.keys()) {
      if (!activeIds.has(id)) {
        this.cursorMap.delete(id);
      }
    }

    this.selections = selectionResult;
  };

  /** Continuously lerp cursors toward their targets at screen refresh. */
  #startLerpLoop() {
    const tick = () => {
      this.animFrameId = requestAnimationFrame(tick);

      if (!this.needsLerp) return;

      let stillMoving = false;
      for (const cursor of this.cursorMap.values()) {
        const dx = cursor.tx - cursor.x;
        const dy = cursor.ty - cursor.y;

        if (Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON) {
          cursor.x += dx * LERP;
          cursor.y += dy * LERP;
          stillMoving = true;
        } else {
          cursor.x = cursor.tx;
          cursor.y = cursor.ty;
        }
      }

      this.cursors = [...this.cursorMap.values()];
      if (!stillMoving) {
        this.needsLerp = false;
      }
    };
    tick();
  }

  #spawnRipple(x: number, y: number, color: string) {
    const id = rippleIdCounter++;
    this.ripples = [...this.ripples, { id, x, y, color }];
    setTimeout(() => {
      this.ripples = this.ripples.filter((r) => r.id !== id);
    }, 650);
  }

  render() {
    return html`
      ${this.cursors.map(
        (c) => html`
          <div class="cursor" style="transform: translate(${c.x}px, ${c.y}px);">
            <svg viewBox="0 0 16 20" fill="none">
              <path
                d="M0 0L16 12.5L8.5 13.5L12 20L9 21L5.5 14.5L0 19V0Z"
                fill="${c.color}"
                stroke="white"
                stroke-width="1"
                stroke-linejoin="round"
              />
            </svg>
            <span class="label" style="background: ${c.color};">
              ${c.name}
            </span>
          </div>
        `
      )}
      ${this.ripples.map(
        (r) => html`
          <div class="ripple" style="left: ${r.x}px; top: ${r.y}px; color: ${r.color};">
            <div class="ring"></div>
            <div class="dot"></div>
          </div>
        `
      )}
      ${this.selections.map(
        (s) => s.rects.map(
          (r) => html`
            <div
              class="selection-rect"
              style="left: ${r.x}px; top: ${r.y}px; width: ${r.width}px; height: ${r.height}px; background: ${s.color};"
            ></div>
          `
        )
      )}
    `;
  }
}
