/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { sharedStyles } from "../../ui/shared-styles.js";
import { icons } from "../../ui/icons.js";
import { localized, msg } from "@lit/localize";

@localized()
@customElement("o-primitive-chat-box")
export class PrimitiveChatBox extends LitElement {
  static styles = [
    sharedStyles,
    icons,
    css`
      :host {
        display: flex;
        width: 90%;
        max-width: 560px;
        padding: var(--opal-grid-1);
        flex-direction: column;
        align-items: flex-start;

        border-radius: var(--opal-radius-16);
        border: 1px solid var(--opal-color-bubble-border);
        background: var(--opal-color-surface);
        box-shadow: var(--opal-shadow-chat);
        box-sizing: border-box;
      }

      .input-area {
        width: 100%;
        padding: var(--opal-grid-3);
        box-sizing: border-box;
      }

      textarea {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        color: var(--opal-color-on-surface-variant);
        font-feature-settings: var(--opal-label-large-font-feature);
        font-family: var(--opal-font-display);
        font-size: var(--opal-label-large-size);
        font-style: normal;
        font-weight: 400;
        line-height: var(--opal-label-large-line-height);
        resize: none;
        field-sizing: content;
        min-height: 1lh;
        max-height: 4lh;
        scrollbar-width: none;
      }

      textarea::placeholder {
        color: var(--opal-color-on-surface-variant);
        opacity: 0.7;
      }

      .bottom-bar {
        display: flex;
        width: 100%;
        justify-content: space-between;
        align-items: center;
        box-sizing: border-box;
      }

      .left-controls {
        display: flex;
        align-items: center;
        color: var(--opal-color-on-surface-variant);
      }

      .left-controls span {
        display: flex;
        width: var(--opal-grid-8);
        height: var(--opal-grid-8);
        justify-content: center;
        align-items: center;
        cursor: pointer;
        font-size: 20px;
        color: var(--opal-color-icon-resting);
        border-radius: 50%;
        transition: background-color 0.2s ease;
      }

      .left-controls span:hover {
        background-color: var(--opal-color-cta-background);
      }

      .send-btn {
        display: flex;
        width: var(--opal-grid-8);
        height: var(--opal-grid-8);
        justify-content: center;
        align-items: center;
        border-radius: 50%;
        background: var(--opal-color-send-button-background);
        color: var(--opal-color-send-button-foreground);
        border: none;
        cursor: pointer;
        padding: 0;
      }

      .send-btn span {
        font-size: 18px;
      }
    `,
  ];

  render() {
    return html`
      <div class="input-area">
        <textarea .placeholder=${msg("Type your thoughts here...")}></textarea>
      </div>
      <div class="bottom-bar">
        <div class="left-controls">
          <span class="g-icon filled round heavy">add</span>
          <span class="g-icon filled round heavy">tune</span>
        </div>
        <button class="send-btn">
          <span class="g-icon filled round heavy">arrow_forward</span>
        </button>
      </div>
    `;
  }
}
