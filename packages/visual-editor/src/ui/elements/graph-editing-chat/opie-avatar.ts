/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";

@customElement("bb-opie-avatar")
export class OpieAvatar extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true })
  accessor mode: "hero" | "normal" | "small" = "normal";

  @property({ type: Boolean, reflect: true })
  accessor selected = false;

  @property({ type: Boolean, reflect: true })
  accessor inverted = false;

  @property({ type: Boolean, reflect: true })
  accessor supportsHover = true;

  @property({ type: Boolean, reflect: true, attribute: "static" })
  accessor isStatic = false;

  @property({ type: Boolean, reflect: true })
  accessor highlighted = false;

  @property({ type: String })
  accessor bgColor = "var(--light-dark-n-0)";

  @property({ type: String })
  accessor fgColor = "var(--light-dark-n-50)";

  @property({ type: Number })
  accessor count = 0;

  @state()
  accessor lookDirection: "left" | "center" | "right" = "center";

  @state()
  accessor blinking = false;

  #blinkTimeout: ReturnType<typeof setTimeout> | undefined;

  static styles = css`
    :host {
      display: inline-flex;
      justify-content: center;
      align-items: flex-start;
      width: var(--bb-grid-size-10);
      height: var(--bb-grid-size-10);
      box-sizing: border-box;
      position: relative;
      cursor: pointer;
    }

    :host([selected]) {
      cursor: auto;
    }

    :host::after {
      content: "";
      position: absolute;
      top: -4px;
      left: -4px;
      right: -4px;
      bottom: -4px;
      border: 2px solid var(--light-dark-n-50);
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      transition:
        opacity 0.2s ease,
        border-color 0.2s ease;
    }

    :host([supportsHover]:hover)::after {
      opacity: 1;
      border-color: var(--light-dark-n-50);
    }

    :host([selected])::after {
      opacity: 1;
      border-color: var(--light-dark-n-10);
    }

    :host([highlighted])::after {
      opacity: 1;
      border-color: var(--light-dark-n-50);
    }

    .clipper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      z-index: 1;
    }

    .bg {
      width: 100%;
      height: 100%;
      background: var(--light-dark-n-0);
    }

    .eyes {
      display: flex;
      gap: 5px;
      margin-top: 11px;
      transition: transform 0.1s ease-in-out;
      z-index: 2; /* Above background! */
    }

    .eyes.left {
      transform: translateX(-2px);
    }

    .eyes.right {
      transform: translateX(2px);
    }

    .eye {
      width: 5px;
      height: 10px;
      background: var(--light-dark-n-100);
      border-radius: 2px;
      transition: transform 0.1s ease-in-out;
      transform-origin: center;
    }

    .bubble {
      display: flex;
      width: var(--bb-grid-size-4);
      height: var(--bb-grid-size-4);
      justify-content: center;
      align-items: center;
      position: absolute;
      right: -8px;
      top: -6px;
      border-radius: 50%;
      border: 2px solid var(--light-dark-n-90);
      background: var(--light-dark-n-0);
      color: var(--light-dark-n-100);
      font-family: var(--bb-font-family);
      font-size: 8px;
      font-weight: 500;
      line-height: 16px;
      letter-spacing: 0.1px;
      text-align: center;
      font-feature-settings: "ss02" on;
      leading-trim: both;
      text-edge: cap;
      z-index: 3;
    }

    .eye.blink {
      transform: scaleY(0);
    }

    .eye:nth-child(2) {
      transition-delay: 0.03s;
    }

    :host([mode="small"]) {
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
    }

    :host([mode="small"]) .eyes {
      gap: 2px;
      margin-top: 5px;
    }

    :host([mode="small"]) .eyes.left {
      transform: translateX(-1px);
    }

    :host([mode="small"]) .eyes.right {
      transform: translateX(1px);
    }

    :host([mode="small"]) .eye {
      width: 2px;
      height: 5px;
      border-radius: 1px;
    }

    :host([mode="hero"]) {
      width: var(--bb-grid-size-12);
      height: var(--bb-grid-size-12);
    }

    :host([mode="hero"]) .eyes {
      gap: 5px;
      margin-top: 12px;
    }

    :host([mode="hero"]) .eyes.left {
      transform: translateX(-3px);
    }

    :host([mode="hero"]) .eyes.right {
      transform: translateX(3px);
    }

    :host([mode="hero"]) .eye {
      width: 6px;
      height: 12px;
      border-radius: 3px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (!this.isStatic) {
      this.#scheduleBlink();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.#blinkTimeout);
  }

  #scheduleBlink() {
    const delay = 3000 + Math.random() * 2000;
    this.#blinkTimeout = setTimeout(() => {
      this.#blink();
    }, delay);
  }

  #blink() {
    this.blinking = true;
    setTimeout(() => {
      this.blinking = false;
      const directions: Array<"left" | "center" | "right"> = [
        "left",
        "center",
        "right",
      ];
      this.lookDirection =
        directions[Math.floor(Math.random() * directions.length)];
      this.#scheduleBlink();
    }, 150);
  }

  render() {
    const bgStyle = styleMap({
      backgroundColor: this.inverted ? "var(--light-dark-n-100)" : this.bgColor,
    });

    const eyeStyle = styleMap({
      backgroundColor: this.inverted ? this.bgColor : "var(--light-dark-n-100)",
    });

    return html`
      <div class="clipper">
        <div class="bg" style=${bgStyle}></div>
      </div>
      <div class="${classMap({ eyes: true, [this.lookDirection]: true })}">
        <div
          class="${classMap({ eye: true, blink: this.blinking })}"
          style=${eyeStyle}
        ></div>
        <div
          class="${classMap({ eye: true, blink: this.blinking })}"
          style=${eyeStyle}
        ></div>
      </div>

      ${this.count > 0 ? html`<div class="bubble">${this.count}</div>` : ""}
    `;
  }
}
