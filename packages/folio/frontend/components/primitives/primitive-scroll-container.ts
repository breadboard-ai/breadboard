/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * A container that provides a scrollable area with a fade mask at the top.
 * Optionally supports scroll snapping.
 */
@customElement("o-primitive-scroll-container")
export class PrimitiveScrollContainer extends SignalWatcher(LitElement) {
  @property({ type: Boolean, reflect: true })
  accessor scrollSnap = false;

  static styles = css`
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      container-type: size;
      mask: linear-gradient(
        to bottom,
        #ff00ff00,
        #ff00ff00 var(--opal-grid-5),
        #ff00ffcc var(--opal-grid-7),
        #ff00ff var(--opal-grid-8),
        #ff00ff
      );
    }

    .cards {
      padding: var(--agent-card-overscroll-mask, var(--opal-grid-8)) 0
        calc(var(--agent-card-overscroll-mask, var(--opal-grid-8)) * 2) 0;
      display: flex;
      flex-direction: column;
      gap: var(--opal-grid-3);
      overflow: auto;
      scrollbar-width: none;
      scroll-padding-top: var(--agent-card-overscroll-mask, var(--opal-grid-8));
      height: 100%;
    }

    :host([scrollSnap]) .cards {
      scroll-snap-type: y mandatory;
    }
  `;

  resetScroll() {
    const cards = this.shadowRoot?.querySelector(".cards");
    if (cards) {
      cards.scrollTop = 0;
    }
  }

  render() {
    return html`
      <div class="cards" part="cards">
        <slot></slot>
      </div>
    `;
  }
}
