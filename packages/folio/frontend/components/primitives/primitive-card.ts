/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./primitive-menu.js";
import { MenuItem } from "../../sca/types.js";

if ("CSS" in window && "registerProperty" in CSS) {
  try {
    CSS.registerProperty({
      name: "--mask-size",
      syntax: "<length>",
      inherits: false,
      initialValue: "0px",
    });
  } catch {
    // Property might already be registered
  }
}

@customElement("o-primitive-card")
export class PrimitiveCard extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      background: var(--o-primitive-card-bg, var(--opal-color-surface));
      color: var(--opal-color-on-surface);
      border-radius: var(--opal-radius-pill);
      border: 1px solid
        var(--o-primitive-card-border-color, var(--opal-color-border-subtle));
      gap: var(--opal-grid-3);
      overflow: hidden;
    }

    section {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: var(--opal-grid-8) var(--opal-grid-6);
      gap: var(--opal-grid-6);
      mask: linear-gradient(
        to bottom,
        #ff00ff,
        #ff00ff calc(100% - var(--opal-grid-12)),
        #ff00ff00 100%
      );
    }

    .content {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      opacity: var(--o-primitive-card-content-opacity, 1);
      transition:
        opacity 0.3s ease,
        --mask-size 0.3s ease;
      scrollbar-width: none;
      margin-top: var(--opal-grid-3);
      --mask-size: 0px;
      mask: linear-gradient(
        to bottom,
        #ff00ff,
        #ff00ff calc(100% - var(--mask-size)),
        #ff00ff00 100%
      );
    }

    :host([can-scroll]) .content {
      --mask-size: var(--opal-grid-6);
    }

    :host([has-actions]) .content {
      padding-bottom: var(--opal-grid-6);
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--opal-grid-4);
    }

    ::slotted([slot="title"]) {
      font-family: var(--opal-font-display);
      font-size: var(--opal-headline-large-size);
      font-weight: var(--opal-headline-large-weight);
      line-height: var(--opal-headline-large-line-height);
      font-feature-settings: var(--opal-headline-large-font-feature);
      color: var(--o-primitive-card-title-color, var(--opal-color-on-surface));
      display: block;
    }

    ::slotted([slot="subtitle"]) {
      font-family: var(--opal-font-display);
      font-size: var(--opal-body-medium-size);
      font-weight: var(--opal-body-medium-weight);
      line-height: var(--opal-body-medium-line-height);
      font-feature-settings: var(--opal-body-medium-font-feature);
      color: var(
        --o-primitive-card-subtitle-color,
        var(--Neutral-600, #80868b)
      );
      display: block;
    }

    ::slotted([slot="content"]) {
      font-family: var(--opal-font-display);
      font-size: var(--opal-body-large-size);
      font-weight: var(--opal-body-large-weight);
      line-height: var(--opal-body-large-line-height);
      font-feature-settings: var(--opal-body-large-font-feature);
      color: var(
        --o-primitive-card-content-color,
        var(--opal-color-on-surface-variant)
      );
      height: 100%;
      width: 100%;
    }

    ::slotted([slot="actions"]) {
      display: flex;
      justify-content: space-between;
      margin-top: auto;
    }
  `;

  @property({ type: Boolean, reflect: true, attribute: "has-actions" })
  accessor hasActions = false;

  @property({ type: Boolean, reflect: true, attribute: "can-scroll" })
  accessor canScroll = false;

  @property({ type: Array })
  accessor actions: MenuItem[] | null = null;

  private _resizeObserver: ResizeObserver | null = null;

  private _onActionsChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    this.hasActions = slot.assignedNodes().length > 0;
  }

  override firstUpdated() {
    const contentDiv = this.shadowRoot?.querySelector(".content");
    if (contentDiv) {
      this._resizeObserver = new ResizeObserver(() => {
        this.canScroll = contentDiv.scrollHeight > contentDiv.clientHeight;
      });
      this._resizeObserver.observe(contentDiv);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
  }

  render() {
    return html`
      <section>
        <header>
          <div>
            <slot name="title"></slot>
            <slot name="subtitle"></slot>
          </div>
          ${this.actions && this.actions.length > 0
            ? html`<o-primitive-menu .items=${this.actions}></o-primitive-menu>`
            : nothing}
        </header>
        <div class="content">
          <slot name="content"></slot>
        </div>
        <slot name="actions" @slotchange="${this._onActionsChange}"></slot>
      </section>
    `;
  }
}
