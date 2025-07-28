/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { VisualEditorStatusUpdate } from "../../types/types";
import { repeat } from "lit/directives/repeat.js";
import { markdown } from "../../directives/markdown";
import { icons } from "../../styles/icons";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-status-update-modal")
export class VEStatusUpdateModal extends LitElement {
  @property()
  accessor updates: VisualEditorStatusUpdate[] = [];

  static styles = [
    type,
    colorsLight,
    icons,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      #update-list {
        padding: var(--bb-grid-size-4) 0;
        mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0%,
          #ff00ff var(--bb-grid-size-4),
          #ff00ff calc(100% - var(--bb-grid-size-4)),
          rgba(0, 0, 0, 0) 100%
        );
        overflow: scroll;
        scrollbar-width: none;
        max-height: min(480px, 50svh);
        max-width: min(550px, 40svw);

        & .update {
          margin-bottom: var(--bb-grid-size-2);
          border: 1px solid var(--n-90);
          border-radius: var(--bb-grid-size-3);
          padding: var(--bb-grid-size-2);
          background: var(--n-98);

          &.urgent {
            border-color: var(--e-80);
            background: var(--e-95);
            color: var(--e-30);
          }

          &.warning {
            border-color: var(--ui-warning-border-color);
            background: var(--ui-warning-background-color);
            color: var(--ui-warning-text-color);
          }

          & h1 {
            display: flex;
            align-items: center;
            margin: 0;
            padding: 0 0 var(--bb-grid-size) 0;
          }

          & p {
            margin: 0 0 var(--bb-grid-size-2) 0;

            &:last-of-type {
              margin-bottom: 0;
            }
          }

          &:last-of-type {
            margin-bottom: 0;
          }
        }
      }

      .g-icon {
        margin-right: var(--bb-grid-size-2);
      }
    `,
  ];

  render() {
    return html`<bb-modal
      .icon=${"bigtop_updates"}
      .modalTitle=${"Status Update"}
      .showCloseButton=${true}
    >
      ${this.updates.length > 0
        ? html`
            <section id="update-list">
              ${repeat(this.updates, (update) => {
                let icon;
                switch (update.type) {
                  case "info":
                    icon = html`info`;
                    break;

                  case "warning":
                    icon = html`warning`;
                    break;

                  case "urgent":
                    icon = html`error`;
                    break;

                  default:
                    icon = nothing;
                    break;
                }

                return html`<section
                  class=${classMap({ update: true, [update.type]: true })}
                >
                  <h1 class="sans-flex md-title-medium w-400 round">
                    <span class="g-icon round">${icon}</span>${update.date}
                  </h1>
                  <p class="md-body-medium">${markdown(update.text)}</p>
                </section>`;
              })}
            </section>
          `
        : html`No recent updates`}
    </bb-modal>`;
  }
}
