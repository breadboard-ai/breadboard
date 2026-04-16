/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { localized, msg } from "@lit/localize";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { scaContext } from "../../sca/context/context.js";
import { SCA } from "../../sca/sca.js";
import { sharedStyles } from "../../ui/shared-styles.js";
import { map } from "lit/directives/map.js";
import { icons } from "../../ui/icons.js";

import "../primitives/primitive-card.js";
import "../primitives/primitive-avatar.js";
import "../primitives/primitive-agent-card.js";
import "../primitives/primitive-editorial-cta.js";

@localized()
@customElement("o-page-home")
export class PageHome extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    sharedStyles,
    icons,
    css`
      :host {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
        width: calc(100% - var(--opal-width-sidebar));
        height: 100%;

        --agent-card-peek-size: var(--opal-grid-16);
        --agent-card-overscroll-mask: var(--opal-grid-8);
      }

      :host > header {
        margin: var(--opal-grid-7) 0 var(--opal-grid-1) 0;
      }

      .scrollable-cards {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        container-type: size;
        mask: linear-gradient(
          to bottom,
          #ff00ff00,
          #ff00ff00 var(--opal-grid-5),
          #ff00ffcc var(--opal-grid-7),
          #ff00ff var(--opal-grid-8),
          #ff00ff
        );

        & .cards {
          padding: var(--agent-card-overscroll-mask) 0
            calc(var(--agent-card-overscroll-mask) * 2) 0;
          display: flex;
          flex-direction: column;
          gap: var(--opal-grid-3);
          overflow: auto;
          scrollbar-width: none;
          scroll-snap-type: y mandatory;
          scroll-padding-top: var(--agent-card-overscroll-mask);

          & o-primitive-agent-card {
            flex: 1 0 auto;
            width: 100%;
            height: calc(
              100cqh - var(--agent-card-peek-size) - var(
                  --agent-card-overscroll-mask
                )
            );
            scroll-snap-align: start;
          }

          @media (min-width: 1640px) {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--opal-grid-4);
          }
        }

        .card-actions {
          display: flex;
          justify-content: space-between;
          margin-top: var(--opal-grid-3);
        }

        .card-actions button {
          display: flex;
          height: var(--opal-grid-10);
          padding: 0 var(--opal-grid-6);
          justify-content: center;
          align-items: center;
          gap: var(--opal-grid-2);
          border-radius: var(--opal-radius-20);
          border: 1px solid var(--opal-color-secondary-button-border);
          background: var(--opal-color-secondary-button-background);
          color: var(--opal-color-icon-resting);
          cursor: pointer;
          text-align: center;
          font-feature-settings: var(--opal-label-large-font-feature);
          font-family: var(--opal-font-display);
          font-size: var(--opal-label-large-size);
          font-style: normal;
          font-weight: var(--opal-label-large-weight);
          line-height: var(--opal-label-large-line-height);
        }
      }
    `,
  ];

  #renderHeader(name = "Maya") {
    return html`<header>
      <h1>${msg(html`Hi ${name}, here's what's top of mind today!</h1>`)}
    </header>`;
  }

  #renderAgentCards() {
    const agents = this.sca.controller.agent.agents;

    return html`
      ${map(agents, (agent) => {
        return html`
          <div>
            <o-primitive-agent-card .agentId=${agent.id}>
              ${map(agent.cards, (card) => {
                return html`
                  <o-primitive-card>
                    <h2 slot="header">${card.header}</h2>
                    <div slot="content">
                      <p>${card.content}</p>
                      ${card.cta
                        ? html`
                            <o-primitive-editorial-cta
                              style="--current-agent-color: ${agent.bgColor}"
                            >
                              ${card.cta.logo
                                ? html`<img
                                    slot="icon"
                                    src="${card.cta.logo}"
                                    alt="${card.cta.title} logo"
                                  />`
                                : nothing}
                              ${card.cta.icon && !card.cta.logo
                                ? html`<span
                                    slot="icon"
                                    class="g-icon filled heavy round"
                                    >${card.cta.icon}</span
                                  >`
                                : nothing}
                              <h3 slot="title">${card.cta.title}</h3>
                              ${card.cta.price
                                ? html`<aside slot="price">
                                    ${card.cta.price}
                                  </aside>`
                                : nothing}
                              <button class="primary">
                                ${card.cta.primary}
                              </button>
                              ${card.cta.secondary
                                ? html`<button class="secondary">
                                    ${card.cta.secondary}
                                  </button>`
                                : nothing}
                            </o-primitive-editorial-cta>
                          `
                        : nothing}
                    </div>
                    <div slot="actions" class="card-actions">
                      ${agent.cards.length > 1
                        ? html`<button
                            @click=${(e: Event) =>
                              (e.target as HTMLElement).dispatchEvent(
                                new CustomEvent("card-skip", {
                                  bubbles: true,
                                  composed: true,
                                })
                              )}
                          >
                            Skip
                          </button>`
                        : html`<span></span>`}
                      <button>Ask follow-up</button>
                    </div>
                  </o-primitive-card>
                `;
              })}
            </o-primitive-agent-card>
          </div>
        `;
      })}
    `;
  }

  render() {
    return html`
      ${this.#renderHeader()}
      <div class="scrollable-cards">
        <div class="cards">${this.#renderAgentCards()}</div>
      </div>
    `;
  }
}
