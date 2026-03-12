// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared guest list — backed by a Yjs Y.Array.
 *
 * This is the first CRDT-backed collaborative surface. Each guest is a
 * Y.Map with `name` and `addedBy` fields. Adds and removes from any
 * connected client are automatically merged without conflicts.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { doc } from "./sync.js";
import { getIdentity } from "./identity.js";
import * as Y from "yjs";

interface GuestEntry {
  name: string;
  addedBy: string;
}

const guestArray = doc.getArray<Y.Map<string>>("guests");

@customElement("party-guest-list")
export class PartyGuestList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .add-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .add-row input {
      flex: 1;
    }

    .guest-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .guest-entry {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--color-surface-alt, #22222e);
      font-size: 14px;
      transition: background 0.15s;
    }

    .guest-entry:hover {
      background: var(--color-border, #2e2e3e);
    }

    .guest-name {
      flex: 1;
    }

    .added-by {
      font-size: 11px;
      color: var(--color-text-muted, #8888a0);
      margin-right: 8px;
    }

    .remove-btn {
      background: transparent;
      color: var(--color-danger, #f87171);
      padding: 2px 8px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .guest-entry:hover .remove-btn {
      opacity: 1;
    }

    .empty {
      font-size: 13px;
      color: var(--color-text-muted, #8888a0);
      font-style: italic;
      padding: 8px 0;
    }
  `;

  @state() private guests: GuestEntry[] = [];
  @query("input") private input!: HTMLInputElement;

  connectedCallback() {
    super.connectedCallback();
    guestArray.observe(this.#handleChange);
    this.#handleChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    guestArray.unobserve(this.#handleChange);
  }

  #handleChange = () => {
    this.guests = guestArray.toArray().map((ymap) => ({
      name: ymap.get("name") || "",
      addedBy: ymap.get("addedBy") || "unknown",
    }));
  };

  #addGuest() {
    const name = this.input?.value?.trim();
    if (!name) return;

    const identity = getIdentity();
    const guestMap = new Y.Map<string>();
    guestMap.set("name", name);
    guestMap.set("addedBy", identity?.name || "anonymous");
    guestArray.push([guestMap]);

    this.input.value = "";
    this.input.focus();
  }

  #removeGuest(index: number) {
    guestArray.delete(index, 1);
  }

  #handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") this.#addGuest();
  }

  render() {
    return html`
      <h2>Guest List</h2>
      <div class="add-row">
        <input
          type="text"
          placeholder="Add a guest…"
          @keydown=${this.#handleKeydown}
        />
        <button @click=${this.#addGuest}>Add</button>
      </div>
      <div class="guest-list">
        ${this.guests.length === 0
          ? html`<div class="empty">No guests yet — add someone!</div>`
          : this.guests.map(
              (guest, i) => html`
                <div class="guest-entry">
                  <span class="guest-name">${guest.name}</span>
                  <span class="added-by">added by ${guest.addedBy}</span>
                  <button class="remove-btn" @click=${() => this.#removeGuest(i)}>
                    ✕
                  </button>
                </div>
              `
            )}
      </div>
    `;
  }
}
