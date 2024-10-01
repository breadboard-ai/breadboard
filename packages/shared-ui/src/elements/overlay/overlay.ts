/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { OverlayDismissedEvent } from "../../events/events.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";

@customElement("bb-overlay")
export class Overlay extends LitElement {
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #contentRef: Ref<HTMLDivElement> = createRef();

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

    #wrapper {
      min-width: 300px;
      width: max(40vw, 450px);
      min-height: 250px;
      height: max(50vh, 450px);
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: auto;
    }

    #content {
      border-radius: var(--bb-grid-size-2);
      background: #fff;

      display: flex;
      flex-direction: column;

      opacity: 0;
      animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    :host([inline]) #background {
      background: transparent;
    }

    :host([inline]) #content {
      position: fixed;
      left: var(--left, auto);
      top: var(--top, auto);
      border: 1px solid var(--bb-neutral-300);
      box-shadow:
        0 8px 8px 0 rgba(0, 0, 0, 0.07),
        0 15px 12px 0 rgba(0, 0, 0, 0.09);

      right: var(--right, auto);
      bottom: var(--bottom, auto);
    }

    :host([passthru]) {
      pointer-events: none;
    }

    :host([passthru]) #background {
      display: none;
    }

    :host([passthru]) #content {
      pointer-events: auto;
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

    this.dispatchEvent(new OverlayDismissedEvent());
  }

  get contentBounds(): DOMRect {
    if (!this.#contentRef.value) {
      return new DOMRect(0, 0, 0, 0);
    }

    const bounds = this.#contentRef.value.getBoundingClientRect();
    return bounds;
  }

  render() {
    return html`
    <div id="background" @pointerdown=${(evt: Event) => {
      evt.stopImmediatePropagation();
      this.dispatchEvent(new OverlayDismissedEvent());
    }}></div>
    <div id="content" ${ref(this.#contentRef)} @pointerdown=${(evt: Event) => {
      evt.stopImmediatePropagation();
    }}><slot></div>`;
  }
}
