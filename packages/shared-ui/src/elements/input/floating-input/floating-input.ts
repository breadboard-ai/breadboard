/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { ResizeEvent } from "../../../events/events";

@customElement("bb-floating-input")
export class FloatingInput extends LitElement {
  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      max-width: 800px;
      width: 100%;
    }

    #container {
      display: flex;
      margin: var(--container-margin, 0);
      padding: var(--bb-grid-size-4);
      border-radius: var(--bb-grid-size-4);
      border: 1px solid var(--bb-neutral-500);
      background: var(--bb-neutral-50);
    }
  `;

  #resizeObserver = new ResizeObserver((entries) => {
    const newest = entries.at(-1);
    if (!newest) {
      return;
    }

    this.dispatchEvent(new ResizeEvent(newest.contentRect));
  });

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.#resizeObserver.disconnect();
  }

  render() {
    return html`<section id="container">Floating Input</section>`;
  }
}
