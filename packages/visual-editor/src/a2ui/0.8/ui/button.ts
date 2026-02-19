/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root.js";
import { StateEvent } from "../events/events.js";
import { Action } from "../types/components.js";

export { Button };

import { detectMedia } from "./utils/detect-media.js";

/**
 * Interactive button component that dispatches `a2ui.action` events.
 *
 * Buttons can contain arbitrary child content (text, images, etc.) rendered
 * into their light DOM. The component detects media children via a
 * `MutationObserver` and reflects a `has-media` attribute for conditional
 * styling — media buttons get a border overlay, non-media buttons get a
 * background hover transition.
 *
 * Button borders use a `::after` pseudo-element overlay to avoid layout shifts
 * when the border width changes on hover (e.g. 1px → 2px).
 */
@customElement("a2ui-button")
class Button extends Root {
  @property()
  accessor action: Action | null = null;

  @property({ reflect: true, type: Boolean })
  accessor primary = false;

  @property({ reflect: true, type: Boolean, attribute: "has-media" })
  accessor hasMedia = false;

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex: var(--weight);
        min-height: 0;
        overflow: hidden;
      }

      button {
        font-family: var(--a2ui-font-family-flex);
        font-style: normal;
        font-weight: 500;
        padding: 0;
        border-radius: var(--a2ui-button-radius, 20px);
        border: none;
        background: var(--a2ui-button-bg, var(--light-dark-n-100));
        color: var(--a2ui-button-color, light-dark(var(--p-20), var(--n-100)));
        cursor: pointer;
        overflow: hidden;
        position: relative;
        transition: background var(--a2ui-transition-speed) ease;

        /* Override text colors for slotted children (e.g. Text) */
        --a2ui-color-on-surface: var(
          --a2ui-button-color,
          light-dark(var(--p-20), var(--n-100))
        );
        --a2ui-color-secondary: var(
          --a2ui-button-color,
          light-dark(var(--p-20), var(--n-100))
        );

        /* Child component padding — text gets padding, media is full-bleed. */
        --a2ui-text-padding: var(
          --a2ui-button-text-padding,
          var(--a2ui-spacing-4)
        );
        --a2ui-image-padding: var(--a2ui-button-image-padding, 0);
        --a2ui-video-padding: var(--a2ui-button-video-padding, 0);
        --a2ui-audio-padding: var(--a2ui-button-audio-padding, 0);

        /* Media inside buttons loses its border-radius. */
        --a2ui-image-radius: var(--a2ui-button-image-radius, 0);
        --a2ui-video-radius: var(--a2ui-button-video-radius, 0);

        /* Layout children pack tight — individual elements handle spacing. */
        --a2ui-column-gap: var(--a2ui-button-column-gap, 0);
        --a2ui-row-gap: var(--a2ui-button-row-gap, 0);
      }

      button::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        border: var(--a2ui-button-border, none);
        pointer-events: none;
        transition: border var(--a2ui-transition-speed) ease;
      }

      button:hover::after {
        border: var(--a2ui-button-hover-border, none);
      }

      /* Media buttons get a border by default (overridable via tokens). */
      :host([has-media]) button::after {
        border: var(--a2ui-button-border, 1px solid var(--n-60));
      }

      :host([has-media]) button:hover::after {
        border: var(
          --a2ui-button-hover-border,
          2px solid var(--light-dark-n-0)
        );
      }

      :host([primary]) button {
        background: var(--a2ui-button-bg, var(--light-dark-n-0));
        color: var(--a2ui-button-color, var(--light-dark-n-100));

        --a2ui-color-on-surface: var(
          --a2ui-button-color,
          var(--light-dark-n-100)
        );
        --a2ui-color-secondary: var(
          --a2ui-button-color,
          var(--light-dark-n-100)
        );
      }

      /* Non-media buttons: fixed height + side padding. */
      :host(:not([has-media])) button {
        height: var(--a2ui-button-height, 40px);
        padding: var(--a2ui-button-padding, 0 16px);
        --a2ui-text-padding: 0;
      }

      /* Non-media hover: background change. */
      :host(:not([has-media])) button:hover {
        background: var(--a2ui-button-hover-bg, var(--light-dark-s-98));
      }

      :host([primary]:not([has-media])) button:hover {
        background: var(--a2ui-button-hover-bg, var(--light-dark-n-15));
      }
    `,
  ];

  #mediaObserver: MutationObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.#mediaObserver = new MutationObserver(() => this.#checkMedia());
    this.#mediaObserver.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#mediaObserver?.disconnect();
    this.#mediaObserver = null;
  }

  #checkMedia() {
    const hasMedia = detectMedia(this);
    if (hasMedia !== this.hasMedia) {
      this.hasMedia = hasMedia;
    }
  }

  render() {
    return html`<button
      @click=${() => {
        if (!this.action) {
          return;
        }
        const evt = new StateEvent<"a2ui.action">({
          eventType: "a2ui.action",
          action: this.action,
          dataContextPath: this.dataContextPath,
          sourceComponentId: this.id,
          sourceComponent: this.component,
        });
        this.dispatchEvent(evt);
      }}
    >
      <slot></slot>
    </button>`;
  }
}
