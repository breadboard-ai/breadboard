/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { OverlayDismissedEvent } from "../../../events/events";

@customElement("bb-sidenav")
export class SideNav extends LitElement {
  @property({ reflect: true, type: Boolean })
  accessor active = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      pointer-events: none;
      border: inset 1px solid red;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
    }

    #cover {
      background: transparent;
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }

    #contents {
      position: relative;
      z-index: 1;
      transition: translate 0.3s cubic-bezier(0, 0, 0.3, 1);
      translate: calc(-100% - 10px) 0;
      background: var(--s-90, var(--neutral-0));
      box-shadow: 0px 0px 8.1px -1px rgba(0, 0, 0, 0.15);
      padding: var(--bb-grid-size-5) var(--bb-grid-size-3);
      overflow: scroll;
      scrollbar-width: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 90%;
      height: 100%;
      max-width: 400px;
    }

    :host([active]) {
      pointer-events: auto;

      #contents {
        translate: 0 0;
      }
    }
  `;

  render() {
    return html` <div
        @click=${() => {
          this.dispatchEvent(new OverlayDismissedEvent());
        }}
        id="cover"
      ></div>
      <section id="contents">
        <div>
          <div id=""><slot name="title"></slot></div>
          <slot name="top"></slot>
        </div>
        <div>
          <slot name="bottom"></slot>
        </div>
      </section>`;
  }
}
