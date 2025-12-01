/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import * as Styles from "../../styles/styles";
import { createRef, Ref, ref } from "lit/directives/ref.js";

@customElement("bb-prompt-view")
export class PromptView extends SignalWatcher(LitElement) {
  @property()
  accessor prompt: string | null = null;

  @property({ reflect: true, attribute: true, type: Boolean })
  accessor expanded = false;

  @property({ reflect: true, attribute: true, type: Boolean })
  accessor overflowing = false;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    Styles.HostColorsMaterial.baseColors,
    Styles.HostType.type,
    css`
      :host {
        display: block;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        border: 1px solid var(--sys-color--surface-variant);
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
        color: var(--sys-color--on-surface);
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
        color: var(--sys-color--on-surface);
        border-radius: var(--bb-grid-size);

        &:not([disabled]) {
          cursor: pointer;
        }

        & .g-icon {
          display: none;
          color: var(--sys-color--on-surface);

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

      :host([overflowing]) {
        & button .g-icon {
          display: flex;
        }
      }
    `,
  ];

  #promptContainer: Ref<HTMLDivElement> = createRef();

  protected updated(changedProperties: PropertyValues<this>): void {
    if (!changedProperties.has("prompt") || !this.#promptContainer.value) {
      return;
    }

    if (
      this.#promptContainer.value.scrollHeight >
      this.#promptContainer.value.clientHeight
    ) {
      requestAnimationFrame(() => {
        this.overflowing = true;
      });
    }
  }

  render() {
    if (!this.prompt) {
      return nothing;
    }

    return html`<div id="container">
      <button
        class="w-400 md-body-small sans-flex"
        ?disabled=${!this.overflowing}
        @click=${() => {
          this.expanded = !this.expanded;
        }}
      >
        <span>Original prompt:</span>
        <span class="g-icon filled-heavy round"></span>
      </button>
      <div
        ${ref(this.#promptContainer)}
        id="content"
        class="w-400 md-title-medium sans-flex"
      >
        ${this.prompt && this.prompt.trim() !== ""
          ? this.prompt
          : "No prompt provided"}
      </div>
    </div>`;
  }
}
