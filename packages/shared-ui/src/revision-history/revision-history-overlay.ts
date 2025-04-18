/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../styles/icons.js";
import { SignalWatcher } from "@lit-labs/signals";
import type { EditHistory } from "@google-labs/breadboard";
import { HighlightEvent } from "../elements/step-editor/events/events.js";
import { createRef, ref } from "lit/directives/ref.js";

@customElement("bb-revision-history-overlay")
export class RevisionHistoryOverlay extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    css`
      #overlay {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        z-index: 1;
        cursor: not-allowed;
      }
      .g-icon {
        font-variation-settings:
          "FILL" 0,
          "wght" 600,
          "GRAD" 0,
          "opsz" 48;
      }
      #banner {
        width: 100%;
        padding: var(--bb-grid-size-3);
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        display: inline-flex;
        flex-direction: column;
        cursor: initial;
        background: var(--bb-neutral-0);
        box-shadow: 0 2px 5px 0px rgb(0 0 0 / 10%);
        transition: box-shadow 1s ease-out;
      }
      :host([highlighted]) #banner {
        transition: box-shadow 200ms ease-in;
        box-shadow: 0 0 10px 4px rgb(0 150 255 / 50%);
      }
      #buttons {
        display: inline-flex;
        align-items: center;
      }
      #date {
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);

        /* Ensure there is enough space for the longest date so that changing
        revisions doesn't bounce around. */
        min-width: 10em;
        text-align: center;
      }
      #message {
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);

        margin: 0 0 12px 0;
      }
      #back-button {
        background: none;
        display: inline;
        padding: 10px;
        border: none;
        cursor: pointer;
        transition: color 100ms;
        & > .g-icon {
          font-size: 24px;
        }
        &:hover {
          color: var(--bb-neutral-600);
        }
      }
      #restore-button {
        margin-left: 24px;
        background: var(--bb-ui-500);
        display: inline-flex;
        align-items: center;
        font-family: inherit;
        border: none;
        border-radius: 64px;
        color: var(--bb-neutral-0);
        padding: 10px 20px;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        & > .g-icon {
          margin-right: 8px;
        }
        transition:
          box-shadow 0.15s,
          filter 0.15s;
        &:hover {
          filter: brightness(105%);
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.3),
            0 1px 3px 1px rgba(0, 0, 0, 0.15);
        }
      }
    `,
  ];

  #banner = createRef<HTMLElement>();

  @property({ attribute: false })
  accessor history: EditHistory | undefined | null = undefined;

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  render() {
    const history = this.history;
    if (
      !history ||
      history.pending ||
      history.index() === history.entries().length - 1
    ) {
      return nothing;
    }
    const revision = history.entries()[history.index()];
    if (!revision) {
      return nothing;
    }
    const formattedDate = new Date(revision.timestamp)
      .toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
      .replace(" at ", ", ");
    return html`
      <div id="overlay" @click=${this.#onClickOverlay}>
        <div id="banner" ${ref(this.#banner)}>
          <!-- <h2 id="message">You are viewing an older version</h2> -->
          <div id="buttons">
            <button id="back-button" @click=${this.#onClickBack}>
              <span class="g-icon">arrow_back</span>
            </button>
            <span id="date">${formattedDate}</span>
            <button id="restore-button" @click=${this.#onClickRestore}>
              <span class="g-icon">history</span>
              Restore this version
            </button>
          </div>
        </div>
      </div>
    `;
  }

  #onClickBack() {
    if (!this.history) {
      return;
    }
    if (this.history.entries().length > 0 && !this.history.pending) {
      this.history.jump(this.history.entries().length - 1);
      this.dispatchEvent(new HighlightEvent(null));
    }
  }

  #onClickRestore() {
    if (!this.history) {
      return;
    }
    this.history.revertTo(this.history.index());
  }

  #onClickOverlay(event: MouseEvent & { target: Node }) {
    if (this.highlighted || this.#banner.value?.contains(event.target)) {
      return;
    }
    this.highlighted = true;
    setTimeout(() => (this.highlighted = false), 1500);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-revision-history-overlay": RevisionHistoryOverlay;
  }
}
