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
import "../primitives/primitive-scroll-container.js";

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
        width: calc(100% - var(--opal-layout-sidebar-width));
        height: 100%;

        --agent-card-peek-size: var(--opal-grid-16);
        --agent-card-overscroll-mask: var(--opal-grid-8);
      }

      :host > header {
        margin: var(--opal-grid-7) 0 var(--opal-grid-1) 0;
      }

      o-primitive-agent-card o-primitive-card {
        --o-primitive-card-border-color: transparent;
      }

      o-primitive-scroll-container > o-primitive-agent-card {
        flex: 1 0 auto;
        width: 100%;
        height: calc(
          100cqh - var(--agent-card-peek-size) - var(
              --agent-card-overscroll-mask
            )
        );
        opacity: 0;
        transform: translateY(80px);
        animation: card-reveal 0.35s ease-out forwards;
        animation-delay: calc(var(--card-index, 0) * 60ms);
      }

      @keyframes card-reveal {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }

      o-primitive-scroll-container[scrollSnap] [data-snap] {
        scroll-snap-align: start;
      }

      o-primitive-scroll-container::part(cards) {
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
        border: 1px solid var(--opal-color-border-subtle);
        background: var(--opal-color-surface);
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
    `,
  ];

  #renderHeader() {
    const name = this.sca.controller.account.name;
    return html`<header>
      <h1>${msg(html`Hi ${name}, here's what's top of mind today!</h1>`)}
    </header>`;
  }

  #renderAgentCards() {
    const agents = this.sca.controller.agent.agents;

    return html`
      ${map(agents, (agent, index) => {
        const digestTasks = agent.tasks.filter((t) => t.digest);
        return html`
          <o-primitive-agent-card
            data-snap
            .agentId=${agent.id}
            style="--agent-color: ${agent.bgColor}; --agent-text-color: ${agent.fgColor}; --card-index: ${index}"
          >
            ${map(digestTasks, (task) => {
              const digest = task.digest!;
              return html`
                <o-primitive-card>
                  <h2 slot="title">${digest.title}</h2>
                  <div slot="content">
                    <p>${digest.content}</p>
                    ${digest.cta
                      ? html`
                          <o-primitive-editorial-cta>
                            ${digest.cta.logo
                              ? html`<img
                                  slot="icon"
                                  src="${digest.cta.logo}"
                                  alt="${digest.cta.title} logo"
                                />`
                              : nothing}
                            ${digest.cta.icon && !digest.cta.logo
                              ? html`<span
                                  slot="icon"
                                  class="g-icon filled heavy round"
                                  >${digest.cta.icon}</span
                                >`
                              : nothing}
                            <h3 slot="title">${digest.cta.title}</h3>
                            ${digest.cta.price
                              ? html`<aside slot="price">
                                  ${digest.cta.price}
                                </aside>`
                              : nothing}
                            <button class="agent">${digest.cta.primary}</button>
                            ${digest.cta.secondary
                              ? html`<button class="secondary">
                                  ${digest.cta.secondary}
                                </button>`
                              : nothing}
                          </o-primitive-editorial-cta>
                        `
                      : nothing}
                  </div>
                  <div slot="actions" class="card-actions">
                    ${digestTasks.length > 1
                      ? html`<button
                          class="secondary"
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
                    <button class="secondary">Ask follow-up</button>
                  </div>
                </o-primitive-card>
              `;
            })}
          </o-primitive-agent-card>
        `;
      })}
    `;
  }

  render() {
    return html`
      ${this.#renderHeader()}
      <o-primitive-scroll-container scrollSnap>
        ${this.#renderAgentCards()}
      </o-primitive-scroll-container>
    `;
  }
}
