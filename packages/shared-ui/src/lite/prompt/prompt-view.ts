/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import * as Styles from "../../styles/styles";
import { ref } from "lit/directives/ref.js";

@customElement("bb-prompt-view")
export class PromptView extends SignalWatcher(LitElement) {
  @property()
  accessor prompt: string | null = null;

  @property({ reflect: true, attribute: true, type: Boolean })
  accessor expanded = false;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    Styles.HostColors.baseColors,
    Styles.HostType.type,
    css`
      :host {
        display: block;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        border: 1px solid var(--light-dark-n-90);
        border-radius: var(--bb-grid-size-4);
      }

      #content {
        display: block;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: content-box;
      }

      button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: none;
        border: none;
        height: var(--bb-grid-size-8);
        width: 100%;
        padding: 0;
        margin: 0;
        cursor: pointer;
        color: var(--light-dark-n-70);
        border-radius: var(--bb-grid-size);

        & .g-icon {
          color: var(--light-dark-n-0);
          &::before {
            content: "keyboard_arrow_down";
          }
        }
      }

      :host([expanded]) {
        & #content {
          -webkit-line-clamp: initial;
          height: auto;
          overflow: initial;
        }

        & button .g-icon::before {
          content: "keyboard_arrow_up";
        }
      }
    `,
  ];

  #resizeObserver = new ResizeObserver((entries) => {
    console.log(entries);
  });

  render() {
    if (!this.prompt) {
      return nothing;
    }

    return html`<div id="container">
      <button
        class="w-400 md-body-small sans-flex"
        @click=${() => {
          this.expanded = !this.expanded;
        }}
      >
        <span>Original prompt:</span>
        <span class="g-icon filled-heavy round"></span>
      </button>
      <div
        ${ref((el: Element | undefined) => {
          if (!el) {
            this.#resizeObserver.disconnect();
            return;
          }

          this.#resizeObserver.observe(el);
        })}
        id="content"
        class="w-400 md-title-medium sans-flex"
      >
        ${this.prompt}
      </div>
    </div>`;
  }
}
