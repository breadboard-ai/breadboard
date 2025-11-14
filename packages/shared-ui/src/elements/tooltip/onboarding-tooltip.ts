/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { icons } from "../../styles/icons.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { OnboardingAcknowledgedEvent } from "../../events/events.js";

@customElement("bb-onboarding-tooltip")
export class OnboardingTooltip extends LitElement {
  @property() accessor name = "";
  @property() accessor title = "";
  @property() accessor text = "";

  static styles = [
    icons,
    baseColors,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        cursor: auto;
        position: absolute;
        right: 0;
        top: calc(100% + var(--bb-grid-size-8));
        background: var(--light-dark-n-0);
        color: var(--light-dark-n-100);
        border-radius: var(--bb-grid-size-5);
        padding: var(--bb-grid-size-5);
        width: 100svw;
        max-width: 280px;
        display: flex;
        flex-direction: column;
        align-items: start;
        animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1) 0s 1 backwards;
      }

      :host([delayed]) {
        animation-delay: 1s;
      }

      h1,
      p {
        text-align: left;
        color: var(--light-dark-n-100);
        margin: 0 0 var(--bb-grid-size-3) 0;
      }

      span {
        cursor: pointer;
        font-weight: bold;
        align-self: flex-end;
      }

      :host::after {
        content: "";
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        transform: scaleX(0.8) scaleY(1.4) rotate(45deg);
        right: 32px;
        top: -6px;
        background: var(--light-dark-n-0);
      }

      :host::before {
        content: "";
        position: absolute;
        width: 100%;
        height: 40px;
        left: 0;
        top: -40px;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopImmediatePropagation();
    });
  }

  render() {
    return html` <h1 class="md-label-large">${this.title}</h1>
      <p class="md-body-medium">${this.text}</p>
      <span
        aria-role="button"
        @click=${() => {
          this.dispatchEvent(new OnboardingAcknowledgedEvent());
        }}
        >Got it</span
      >`;
  }
}
