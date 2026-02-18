/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../styles/icons.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { OnboardingAcknowledgedEvent } from "../../events/events.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import * as StringsHelper from "../../strings/helper.js";

const Strings = StringsHelper.forSection("Global");

@customElement("bb-onboarding-tooltip")
export class OnboardingTooltip extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  /**
   * The onboarding item ID from the registry.
   * When set, text and title are pulled from the OnboardingController,
   * and the tooltip self-hides when the item is dismissed.
   */
  @property()
  accessor onboardingId: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor delayed = false;

  @property({ reflect: true, type: Boolean })
  accessor stackRight = false;

  @property({ reflect: true, type: Boolean })
  accessor stackTop = false;

  static styles = [
    icons,
    baseColors,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        position: absolute;
        right: var(--right, -12px);
        top: var(--top, calc(100% + var(--bb-grid-size-8)));
        pointer-events: none;
      }

      .container {
        pointer-events: auto;
        user-select: none;
        cursor: auto;
        position: relative;
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

      :host([delayed]) .container {
        animation-delay: 1s;
      }

      h1,
      p {
        text-align: left;
        color: var(--light-dark-n-100);
        margin: 0 0 var(--bb-grid-size-3) 0;
      }

      button {
        cursor: pointer;
        font-weight: 500;
        align-self: flex-end;
        background: none;
        padding: 0;
        margin: 0;
        border: none;
        color: var(--light-dark-n-100);
      }

      .container::after {
        content: "";
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        transform: scaleX(0.8) scaleY(1.4) rotate(45deg);
        right: 16px;
        top: -6px;
        background: var(--light-dark-n-0);
      }

      :host([stackright]) {
        right: auto;
        left: var(--left, -12px);
      }

      :host([stackright]) .container::after {
        left: 16px;
        right: auto;
      }

      :host([stacktop]) {
        transform: translateY(-100%);
      }

      :host([stacktop]) .container::after {
        top: auto;
        bottom: -6px;
      }

      .container::before {
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

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener("click", this.#onClickBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("click", this.#onClickBound);
  }

  #onClickBound = this.#onClick.bind(this);
  #onClick(evt: Event) {
    evt.preventDefault();
    evt.stopImmediatePropagation();
  }

  #renderTitle() {
    const item = this.onboardingId
      ? this.sca.controller.global.onboarding.getItem(this.onboardingId)
      : null;

    if (!item?.titleKey) {
      return nothing;
    }

    return html`<h1 class="md-label-large">${Strings.from(item.titleKey)}</h1>`;
  }

  #renderText() {
    const item = this.onboardingId
      ? this.sca.controller.global.onboarding.getItem(this.onboardingId)
      : null;

    if (!item?.textKey) {
      return nothing;
    }

    return html`<p class="md-body-medium sans">
      ${Strings.from(item.textKey)}
    </p>`;
  }

  #renderButton() {
    return html`<button
      class="md-body-medium sans"
      @click=${(evt: Event) => {
        this.#onClickBound(evt);

        if (this.onboardingId) {
          this.sca.controller.global.onboarding.dismiss(this.onboardingId);
        }

        this.dispatchEvent(new OnboardingAcknowledgedEvent());
      }}
    >
      Got it
    </button>`;
  }

  render() {
    // Only render when this item is the current sequential item for the app's mode.
    if (
      this.onboardingId &&
      !this.sca.controller.global.onboarding.isCurrentItem(this.onboardingId)
    ) {
      return nothing;
    }

    return html`<div class="container">
      ${this.#renderTitle()}${this.#renderText()}${this.#renderButton()}
    </div>`;
  }
}
