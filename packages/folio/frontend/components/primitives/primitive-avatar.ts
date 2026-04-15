/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { classMap } from "lit/directives/class-map.js";

@customElement("o-primitive-avatar")
export class PrimitiveAvatar extends SignalWatcher(LitElement) {
  @property({ type: Boolean, reflect: true })
  accessor small = false;

  @property({ type: Boolean, reflect: true })
  accessor selected = false;

  @property({ type: String })
  accessor bgColor = "#D98880";

  @property({ type: String })
  accessor fgColor = "#7E5109";

  @property({ type: Number })
  accessor count = 3;

  @state()
  accessor lookDirection: "left" | "center" | "right" = "center";

  @state()
  accessor blinking = false;

  #blinkTimeout: ReturnType<typeof setTimeout> | undefined;
  #filterId = `avatar-noise-${Math.random().toString(36).slice(2, 9)}`;
  #seed = Math.floor(Math.random() * 1000);

  static styles = css`
    :host {
      display: inline-flex;
      justify-content: center;
      align-items: flex-start;
      width: var(--opal-grid-10);
      height: var(--opal-grid-10);
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
      border: 2px solid var(--opal-color-avatar-hover-ring);
      border-radius: 50%;
      pointer-events: none;
      opacity: 0;
      transition:
        opacity 0.2s ease,
        border-color 0.2s ease;
    }

    :host(:hover)::after {
      opacity: 1;
      border-color: var(--opal-color-avatar-hover-ring);
    }

    :host([selected])::after {
      opacity: 1;
      border-color: var(--opal-color-avatar-selected-ring);
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
      background: var(--opal-color-avatar-background);
      filter: var(--avatar-filter);
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
      background: var(--opal-color-avatar-eyes);
      border-radius: 2px;
      transition: transform 0.1s ease-in-out;
      transform-origin: center;
    }

    .bubble {
      display: flex;
      width: var(--opal-grid-4);
      height: var(--opal-grid-4);
      justify-content: center;
      align-items: center;
      position: absolute;
      right: -8px;
      top: -6px;
      border-radius: 50%;
      border: 2px solid var(--opal-color-bubble-border);
      background: var(--opal-color-bubble-background);
      color: var(--opal-color-bubble-text);
      font-family: "Google Sans Flex";
      font-size: var(--opal-font-size-bubble);
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

    :host([small]) {
      width: var(--opal-grid-5);
      height: var(--opal-grid-5);
    }

    :host([small]) .eyes {
      gap: 2px;
      margin-top: 5px;
    }

    :host([small]) .eyes.left {
      transform: translateX(-1px);
    }

    :host([small]) .eyes.right {
      transform: translateX(1px);
    }

    :host([small]) .eye {
      width: 2px;
      height: 5px;
      border-radius: 1px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.#scheduleBlink();
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
    return html`
      <div class="clipper">
        <div class="bg" style="--avatar-filter: url(#${this.#filterId})"></div>
      </div>
      <div class="${classMap({ eyes: true, [this.lookDirection]: true })}">
        <div class="${classMap({ eye: true, blink: this.blinking })}"></div>
        <div class="${classMap({ eye: true, blink: this.blinking })}"></div>
      </div>

      ${this.count > 0 ? html`<div class="bubble">${this.count}</div>` : ""}

      <!-- Hidden SVG for the filter -->
      ${svg`
        <svg width="0" height="0" style="position: absolute;">
          <filter id="${this.#filterId}">
            <!-- 1. Generate noise with lower frequency for larger blobs -->
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${this.#seed}" result="noise">
              <animate attributeName="baseFrequency" values="0.03;0.035;0.03" dur="10s" repeatCount="indefinite"/>
            </feTurbulence>

            <!-- 2. Convert to grayscale -->
            <feColorMatrix type="matrix" values="
              0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0    0    0    1 0" in="noise" result="gray"/>

            <!-- 4. Flood background color -->
            <feFlood flood-color="${this.bgColor}" result="bg"/>

            <!-- 5. Flood foreground color -->
            <feFlood flood-color="${this.fgColor}" result="fg"/>

            <!-- 6. Mask foreground with the soft grayscale noise -->
            <feComposite operator="in" in="fg" in2="gray" result="maskedFg"/>

            <!-- 7. Merge -->
            <feComposite operator="over" in="maskedFg" in2="bg" result="coloredNoise"/>

            <!-- 8. Generate static high-frequency noise -->
            <feTurbulence type="fractalNoise" baseFrequency="1" numOctaves="1" result="rawStaticNoise"/>

            <!-- 8.5 Convert static noise to grayscale and set opacity to 0.4 -->
            <feColorMatrix type="matrix" values="
              0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0    0    0    0.8 0" in="rawStaticNoise" result="staticNoise"/>

            <!-- 9. Blend static noise with colored noise -->
            <feBlend mode="overlay" in="coloredNoise" in2="staticNoise"/>
          </filter>
        </svg>
      `}
    `;
  }
}
