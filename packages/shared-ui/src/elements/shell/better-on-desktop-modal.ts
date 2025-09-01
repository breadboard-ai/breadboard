/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { icons } from "../../styles/icons";
import { ModalDismissedEvent, StateEvent } from "../../events/events";

@customElement("bb-better-on-desktop-modal")
export class VEBetterOnDesktopModal extends LitElement {
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

      section {
        width: 80svw;
        max-width: 540px;
      }

      h1,
      h2,
      p,
      li {
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      aside {
        display: flex;
        padding: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;
        justify-content: end;
      }

      #switch {
        display: flex;
        align-items: center;
        background: var(--n-0);
        border: none;
        border-radius: var(--bb-grid-size-16);
        margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-6);
        color: var(--n-100);
        height: var(--bb-grid-size-8);
        padding: 0 var(--bb-grid-size-4);
        font-size: 14px;
        transition: background 0.2s cubic-bezier(0, 0, 0.2, 1);
        cursor: pointer;
      }
    `,
  ];

  render() {
    return html`<bb-modal
      .modalTitle=${"Opal is best experienced on desktop"}
      .showCloseButton=${true}
      .blurBackground=${true}
    >
      <section>
        <p>
          The editor is currently a desktop only experience. Please switch to
          the App view to best consume the app or view this on a desktop device.
        </p>
        <aside>
          <button
            id="switch"
            class="sans"
            @click=${() => {
              this.dispatchEvent(new ModalDismissedEvent());
              this.dispatchEvent(
                new StateEvent({ eventType: "host.modetoggle", mode: "app" })
              );
            }}
          >
            Switch to App view
          </button>
        </aside>
      </section>
    </bb-modal>`;
  }
}
