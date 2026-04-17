/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { scaContext } from "../../sca/context/context.js";
import { SCA } from "../../sca/sca.js";
import { sharedStyles } from "../../ui/shared-styles.js";
import { icons } from "../../ui/icons.js";

import "./primitive-avatar.js";
import { localized, msg } from "@lit/localize";

/**
 * Z-axis step between cards in the stack, in pixels.
 */
const Z_STEP = 100;

/**
 * Y-axis offset between cards, in pixels. Creates the "peek" effect
 * where behind-cards are visible above the current card.
 */
const Y_STEP = 48;

/**
 * Number of cards visible in the stack at any time.
 * Cards outside this window get opacity=0.
 */
const VISIBLE_WINDOW = 4;

/**
 * Surface-container mix percentages for each position in the visible window.
 * Index 0 = current card, index 1 = one behind, index 2 = two behind.
 * Lower percentage = more agent color bleeding through.
 */
const SURFACE_MIX = [100, 60, 30, 0];

/**
 * Content opacity for each position in the visible window.
 */
const CONTENT_OPACITY = [1, 0.2, 0];

/**
 * A card container for an agent, displaying its color, avatar, and name.
 * Cards are arranged along the Z axis and navigated with prev/next controls.
 */
@localized()
@customElement("o-primitive-agent-card")
export class PrimitiveAgentCard extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ type: String })
  accessor agentId!: string;

  @state()
  accessor cardCount = 0;

  @state()
  accessor currentIndex = 0;

  #cards: HTMLElement[] = [];

  static styles = [
    sharedStyles,
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        box-shadow: var(--opal-shadow-resting);
        height: 100%;
      }

      .agent-card {
        height: 100%;
        border-radius: var(--opal-radius-pill);
        padding: var(--opal-grid-6);
        display: flex;
        flex-direction: column;
        gap: var(--opal-grid-6);
      }

      .agent-card-header {
        display: flex;
        align-items: center;
        gap: var(--opal-grid-3);
        color: var(--opal-color-on-accent);
        font-weight: 500;
      }

      .agent-name {
        color: var(--opal-color-on-accent);
        font-feature-settings: var(--opal-title-medium-font-feature);
        font-family: var(--opal-font-display);
        font-size: var(--opal-title-medium-size);
        font-style: normal;
        font-weight: var(--opal-title-medium-weight);
        line-height: var(--opal-title-medium-line-height);
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .card-nav {
        display: flex;
        align-items: center;
        gap: var(--opal-grid-1);
      }

      .card-nav button {
        display: flex;
        width: var(--opal-grid-7);
        height: var(--opal-grid-7);
        padding: 0;
        justify-content: center;
        align-items: center;
        border-radius: 50%;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--opal-color-on-accent);
        opacity: 0.7;
        transition: opacity 0.2s ease-out;
      }

      .card-nav button:hover:not(:disabled) {
        opacity: 1;
      }

      .card-nav button:disabled {
        opacity: 0.3;
        cursor: default;
      }

      .card-nav .card-counter {
        font-family: var(--opal-font-display);
        font-size: var(--opal-label-medium-size);
        color: var(--opal-color-on-accent);
        opacity: 0.7;
        min-width: var(--opal-grid-8);
        text-align: center;
      }

      .expand-icon {
        margin-left: auto;
        cursor: pointer;
        opacity: 0.8;
        background: none;
        border: none;
        padding: 0;
        height: auto;
        width: auto;
        color: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s ease;

        &:hover {
          opacity: 1;
        }
      }

      .agent-card-content {
        display: grid;
        grid-template-columns: 1fr;
        justify-items: center;
        align-items: start;
        min-height: 0;
        flex: 1;
        margin-top: var(--opal-grid-10);
        margin-bottom: var(--opal-grid-20);
        position: relative;
        perspective: 1000px;
        transform-style: preserve-3d;
      }

      .empty-state {
        color: var(--opal-color-on-accent);
        opacity: 0.7;
        font-family: var(--opal-font-display);
        font-size: var(--opal-headline-large-size);
        font-weight: var(--opal-headline-large-weight);
        line-height: var(--opal-headline-large-line-height);
        text-align: center;
        margin-top: var(--opal-grid-20);
        padding: 0 var(--opal-grid-10);
      }

      ::slotted(*) {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        margin: auto;
        width: 80%;
        max-width: 640px;
        height: 100%;
        max-height: 500px;
        transition:
          transform 0.4s ease-out,
          opacity 0.2s cubic-bezier(0, 0, 0.3, 1),
          background 0.4s ease-out;
        transform-style: preserve-3d;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("card-skip", () => this.#next(true));
  }

  #onSlotChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    this.#cards = slot.assignedElements({ flatten: true }) as HTMLElement[];
    this.cardCount = this.#cards.length;
    this.#updateCardPositions();
  }

  #next(wrap = false) {
    if (this.currentIndex < this.cardCount - 1) {
      this.currentIndex++;
      this.#updateCardPositions();
    } else if (wrap) {
      this.currentIndex = 0;
      this.#updateCardPositions();
    }
  }

  #prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.#updateCardPositions();
    }
  }

  #updateCardPositions() {
    for (let i = 0; i < this.#cards.length; i++) {
      const card = this.#cards[i];
      const distance = i - this.currentIndex;

      // Current at Z=0, behind at negative Z, passed at positive Z.
      const zPos = distance * -Z_STEP;
      const yPos = distance * -Y_STEP;

      card.style.transform = `translateZ(${zPos}px) translateY(${yPos}px)`;
      card.style.zIndex = `${this.#cards.length - i}`;

      if (distance < 0 || distance >= VISIBLE_WINDOW) {
        // Outside the visible window.
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
        card.style.removeProperty("--o-primitive-card-bg");
        card.style.setProperty("--o-primitive-card-content-opacity", "0");
      } else {
        // Inside the visible window.
        card.style.opacity = "1";
        card.style.pointerEvents = distance === 0 ? "auto" : "none";

        if (distance === 0) {
          card.style.removeProperty("--o-primitive-card-bg");
        } else {
          const mixPercent = SURFACE_MIX[distance];
          card.style.setProperty(
            "--o-primitive-card-bg",
            `color-mix(in srgb, var(--opal-color-surface-container) ${mixPercent}%, var(--current-agent-color))`
          );
        }

        card.style.setProperty(
          "--o-primitive-card-content-opacity",
          `${CONTENT_OPACITY[distance]}`
        );
      }
    }
  }

  #onAgentClick() {
    this.sca.controller.router.go({ agentId: this.agentId, page: "agent" });
  }

  render() {
    const agent = this.sca.controller.agent.agents.find(
      (a) => a.id === this.agentId
    );

    if (!agent) {
      return html`<div>${msg("Unknown Agent")}</div>`;
    }

    return html`
      <div
        class="agent-card"
        style="background-color: ${agent.bgColor}; --current-agent-color: ${agent.bgColor}"
      >
        <div class="agent-card-header">
          <o-primitive-avatar
            .small=${true}
            .inverted=${true}
            .bgColor=${agent.bgColor}
            .fgColor=${agent.fgColor}
            @click=${() => this.#onAgentClick()}
          ></o-primitive-avatar>
          <span class="agent-name">${agent.name}</span>
          ${this.cardCount > 1
            ? html`
                <div class="card-nav">
                  <button
                    @click=${this.#prev}
                    ?disabled=${this.currentIndex === 0}
                  >
                    <span class="g-icon">chevron_left</span>
                  </button>
                  <span class="card-counter">
                    ${this.currentIndex + 1} / ${this.cardCount}
                  </span>
                  <button
                    @click=${this.#next}
                    ?disabled=${this.currentIndex >= this.cardCount - 1}
                  >
                    <span class="g-icon">chevron_right</span>
                  </button>
                </div>
              `
            : nothing}
          <button @click=${() => this.#onAgentClick()} class="expand-icon">
            <span class="g-icon filled round heavy">expand_content</span>
          </button>
        </div>
        <div class="agent-card-content">
          <slot @slotchange=${this.#onSlotChange}></slot>
          ${this.cardCount === 0
            ? html`<div class="empty-state">
                There are no updates from this agent
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }
}
