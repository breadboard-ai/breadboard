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

@customElement("a2ui-button")
export class Button extends Root {
  @property()
  accessor action: Action | null = null;

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
      }

      button {
        font-family: var(--a2ui-font-family-flex);
        font-style: normal;
        font-weight: 500;
        padding: 0;
        border-radius: var(--a2ui-button-radius, var(--a2ui-border-radius-lg));
        border: none;
        background: var(--a2ui-button-bg, var(--a2ui-color-primary));
        color: var(--a2ui-button-color, var(--a2ui-color-on-primary));
        cursor: pointer;
        transition: opacity var(--a2ui-transition-speed) ease;
        overflow: hidden;

        /* Override text colors for slotted children (e.g. Text) */
        --a2ui-color-on-surface: var(
          --a2ui-button-color,
          var(--a2ui-color-on-primary)
        );
        --a2ui-color-secondary: var(
          --a2ui-button-color,
          var(--a2ui-color-on-primary)
        );

        /* Child component padding — text gets padding, media is full-bleed.
           All overridable via theme's Button overrides. */
        --a2ui-text-padding: var(
          --a2ui-button-text-padding,
          var(--a2ui-spacing-4)
        );
        --a2ui-image-padding: var(--a2ui-button-image-padding, 0);
        --a2ui-video-padding: var(--a2ui-button-video-padding, 0);
        --a2ui-audio-padding: var(--a2ui-button-audio-padding, 0);
      }

      button:hover {
        opacity: var(--a2ui-hover-opacity);
      }
    `,
  ];

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
