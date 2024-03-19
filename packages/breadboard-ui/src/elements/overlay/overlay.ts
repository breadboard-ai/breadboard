/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { BreadboardOverlayDismissedEvent } from "../../events/events.js";

@customElement("bb-overlay")
export class Overlay extends LitElement {
  #onKeyDownBound = this.#onKeyDown.bind(this);

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    #background {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.15);
    }

    #content {
      border-radius: calc(var(--bb-grid-size) * 3);
      background: #fff;

      display: flex;
      flex-direction: column;

      opacity: 0;
      animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    @keyframes fadeIn {
      from {
        transform: scale(0.9, 0.9);
        opacity: 0;
      }

      to {
        transform: none;
        opacity: 1;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key !== "Escape") {
      return;
    }

    this.dispatchEvent(new BreadboardOverlayDismissedEvent());
  }

  render() {
    return html`
    <div id="background" @pointerdown=${() => {
      this.dispatchEvent(new BreadboardOverlayDismissedEvent());
    }}></div>
    <div id="content"><slot></div>`;
  }
}
