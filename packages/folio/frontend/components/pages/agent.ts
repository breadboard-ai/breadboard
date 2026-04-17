/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { localized, msg } from "@lit/localize";
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { repeat } from "lit/directives/repeat.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { scaContext } from "../../sca/context/context.js";
import { SCA } from "../../sca/sca.js";
import { sharedStyles } from "../../ui/shared-styles.js";
import { icons } from "../../ui/icons.js";

import { PrimitiveScrollContainer } from "../primitives/primitive-scroll-container.js";
import "../primitives/primitive-card.js";
import "../primitives/primitive-mini-app.js";

@localized()
@customElement("o-page-agent")
export class PageAgent extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  private _scrollContainerRef: Ref<PrimitiveScrollContainer> = createRef();
  private _lastAgentId: string | undefined = undefined;

  protected willUpdate() {
    const url = this.sca.controller.router.parsedUrl;
    const agentId = url.page === "agent" ? url.agentId : undefined;

    if (agentId !== this._lastAgentId) {
      this._lastAgentId = agentId;
      this.sca.controller.agent.prepareReveal(agentId);
      this.#needsScrollReset = true;
    }
  }

  #needsScrollReset = false;

  protected updated(_changedProperties: PropertyValues<this>) {
    super.updated(_changedProperties);

    if (this.#needsScrollReset) {
      this.#needsScrollReset = false;
      this._scrollContainerRef.value?.resetScroll();
    }
  }

  #onMiniAppReady = () => {
    this.sca.controller.agent.markMiniAppReady();
  };

  static styles = [
    icons,
    sharedStyles,
    css`
      :host {
        width: 100%;
        height: 100%;
      }

      .agent-page-container {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: calc(100% - var(--opal-layout-sidebar-width));
        height: 100%;

        & header {
          margin: var(--opal-grid-7) 0 var(--opal-grid-1) 0;
        }
      }

      .agent-blocks-grid {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr));
        gap: var(--opal-grid-4);
        width: 100%;

        & > :nth-child(odd) {
          --o-primitive-card-bg: var(--opal-color-surface);
          --o-mini-app-bg: var(--opal-color-interactive-surface);
        }

        & > :nth-child(even) {
          --o-primitive-card-bg: var(--opal-color-interactive-surface);
          --o-mini-app-bg: var(--opal-color-surface);
        }

        & > o-primitive-card {
          opacity: 0;
          transform: translateY(8px);
        }

        &.reveal > o-primitive-card {
          animation: card-reveal 0.35s ease-out forwards;
          animation-delay: calc(var(--card-index, 0) * 60ms);
        }
      }

      @keyframes card-reveal {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .scroll-spacer {
        padding-bottom: var(--opal-grid-25);
        width: 100%;
      }

      o-primitive-scroll-container[scrollSnap] [data-snap] {
        scroll-snap-align: start;
      }

      o-primitive-card.full-width {
        grid-column: 1 / -1;
      }

      .agent-title-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin: var(--opal-grid-7) 0 var(--opal-grid-1) 0;
      }

      .agent-title-actions {
        display: flex;
        gap: var(--opal-grid-3);
      }

      .agent-title-actions button.settings {
        background: var(--opal-color-surface-tinted);
        color: var(--opal-color-on-surface-strong);
      }

      .agent-title-actions button.share {
        background: var(--opal-color-on-surface);
        color: var(--opal-color-surface);
      }

      .agent-header {
        display: flex;
        flex-direction: column;
        gap: var(--opal-grid-8);
        background-color: color-mix(
          in oklch,
          var(--agent-color, transparent) 30%,
          transparent
        );
        padding: var(--opal-grid-6);
        border-radius: var(--opal-grid-6) var(--opal-grid-6) var(--opal-grid-6)
          var(--opal-radius-4);
        margin-bottom: var(--opal-grid-5);

        color: var(--opal-color-on-surface-strong);

        & button {
          align-self: start;
        }
      }
    `,
  ];

  #renderAgentName(name = "Unknown Agent") {
    return html`
      <div class="agent-title-container">
        <h1>${name}</h1>
        <div class="agent-title-actions">
          <button class="settings">
            <span class="g-icon">tune</span>
            ${msg("Settings")}
          </button>
          <button class="share">
            <span class="g-icon">share</span>
            ${msg("Share")}
          </button>
        </div>
      </div>
    `;
  }

  #renderHeader(taskCount: number) {
    const name = this.sca.controller.account.name;
    let headerMessage;
    if (taskCount === 0) {
      headerMessage = msg(html`Hi ${name}, we're all up-to-date!`);
    } else if (taskCount === 1) {
      headerMessage = msg(html`Hi ${name}, I have an update for you`);
    } else if (taskCount === 2) {
      headerMessage = msg(html`Hi ${name}, I have a couple of updates for you`);
    } else {
      headerMessage = msg(html`Hi ${name}, I have updates for you`);
    }

    return html`<section class="agent-header" data-snap>
      <h2>${headerMessage}</h2>
      ${taskCount > 0
        ? html`<button class="agent">${msg("Take a look")}</button>`
        : nothing}
    </section>`;
  }

  render() {
    const url = this.sca.controller.router.parsedUrl;
    const agentId = url.page === "agent" ? url.agentId : undefined;
    const agent = this.sca.controller.agent.agents.find(
      (a) => a.id === agentId
    );

    if (!agent) {
      return html`<header>${msg(html`Agent not found`)}</header>`;
    }

    const name = agent.name;
    const taskCount = agent.tasks.filter((t) => t.block).length;

    return html`
      <section
        class="agent-page-container"
        style=${styleMap({
          "--agent-color": agent.bgColor,
          "--agent-text-color": agent.fgColor,
        })}
      >
        ${this.#renderAgentName(name)}
        <o-primitive-scroll-container
          scrollSnap
          ${ref(this._scrollContainerRef)}
        >
          ${this.#renderHeader(taskCount)}
          <div
            class=${classMap({
              "agent-blocks-grid": true,
              reveal: this.sca.controller.agent.revealReady,
            })}
            @mini-app-ready=${this.#onMiniAppReady}
          >
            ${repeat(
              agent.tasks,
              (t) => t.id,
              (t, index) => {
                if (!t.block) return nothing;
                const isFullWidth = t.block.displayHint === "high";
                return html`
                  <o-primitive-card
                    data-snap
                    .actions=${t.block.actions ?? null}
                    class=${classMap({ "full-width": isFullWidth })}
                    style="--card-index: ${index}"
                  >
                    <h2 slot="title">${t.block.title ?? "Task"}</h2>
                    ${t.block.subtitle
                      ? html`<span slot="subtitle">${t.block.subtitle}</span>`
                      : nothing}
                    <div slot="content">
                      ${typeof t.block.content === "string"
                        ? html`<o-primitive-mini-app
                            .src="${t.block.content}"
                            ?borderless=${t.block.borderless ?? false}
                            .tokenOverrides="${{
                              "--agent-color": agent.bgColor,
                              "--agent-text-color": agent.fgColor,
                            }}"
                          ></o-primitive-mini-app>`
                        : html`<div>
                            Fallback content for block type: ${t.block.type}
                          </div>`}
                    </div>
                  </o-primitive-card>
                `;
              }
            )}
          </div>
          <div class="scroll-spacer"></div>
        </o-primitive-scroll-container>
      </section>
    `;
  }
}
