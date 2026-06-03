/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConsoleEntry,
  ConsoleUpdate,
  LLMContent,
  SimplifiedA2UIClient,
} from "@breadboard-ai/types";

type ProductMap = Map<
  string,
  LLMContent | SimplifiedA2UIClient | ConsoleUpdate
>;
import { SignalWatcher } from "@lit-labs/signals";
import { v0_8 } from "../../../a2ui/index.js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";

import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { ToastType } from "../../../sca/types.js";
import { consume } from "@lit/context";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { iconSubstitute } from "../../utils/icon-substitute.js";
import { sharedStyles } from "../output/console-view/shared-styles.js";
import { hasControlPart } from "../../../utils/control.js";

function isConsoleUpdate(
  item: LLMContent | SimplifiedA2UIClient | ConsoleUpdate
): item is ConsoleUpdate {
  return (
    "type" in item &&
    (item.type === "text" ||
      item.type === "links" ||
      item.type === "token-usage")
  );
}

function isTokenUsageOnly(
  product: Map<string, LLMContent | SimplifiedA2UIClient | ConsoleUpdate>
): boolean {
  if (product.size === 0) return false;
  for (const [, item] of product) {
    if (!isConsoleUpdate(item) || item.type !== "token-usage") return false;
  }
  return true;
}

@customElement("bb-run-view")
export class RunView extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor disclaimerContent = "";

  static styles = [
    icons,
    sharedStyles,
    baseColors,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: transparent;
      }

      #container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      #console {
        flex: 1;
        overflow: auto;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        height: 100%;
        scrollbar-width: none;

        &::after {
          content: "";
          display: block;
          height: var(--input-clearance);
          width: 100%;
        }

        & details {
          margin: 0 0 var(--bb-grid-size-4) 0;

          /* Deactivate the details when there are no non-summary elements */
          &:not(:has(> :not(summary))) {
            pointer-events: none;
            cursor: default;
          }

          summary {
            display: flex;
            align-items: center;
            justify-content: center;
            height: var(--bb-grid-size-9);
            border-radius: var(--bb-grid-size-3);
            list-style: none;
            padding: 0 var(--bb-grid-size-3);
            background: light-dark(var(--n-98), var(--n-20));
            font-size: 12px;
            color: light-dark(var(--n-0), var(--nv-98));
            cursor: pointer;

            > * {
              pointer-events: none;
              user-select: none;
            }

            &::-webkit-details-marker {
              display: none;
            }

            & .step-detail {
              display: flex;
              align-items: center;
              justify-content: center;
              flex: 1;
              min-width: 0;
            }

            & .title {
              display: flex;
              align-items: center;
              flex: 1 1 auto;
              min-width: 0;

              & .title-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              & .g-icon {
                flex-shrink: 0;
                margin-left: var(--bb-grid-size);
                animation: rotate 1s linear forwards infinite;
              }

              & .duration {
                flex-shrink: 0;
                color: light-dark(var(--n-70), var(--n-80));
                margin-left: auto;
                padding-left: var(--bb-grid-size);
              }
            }

            & .chevron {
              margin-right: var(--bb-grid-size-4);
              opacity: 0.6;

              &::before {
                content: "keyboard_arrow_up";
              }
            }

            & .g-icon {
              flex: 0 0 auto;

              &.step-icon {
                margin-right: var(--bb-grid-size-2);
              }
            }
          }

          &:not(:has(> :not(summary))) summary .chevron {
            opacity: 0.3;
            cursor: default;
          }

          &[open] > summary {
            margin-bottom: var(--bb-grid-size-3);

            & .chevron::before {
              content: "keyboard_arrow_down";
            }
          }

          & .products {
            list-style: none;
            padding: 0;
            margin: 0;
          }
        }
      }

      bb-floating-input {
        --bb-floating-input-margin: 0px;
        width: 100%;
        padding-bottom: var(--bb-grid-size-6);
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }

      .links-list {
        list-style: none;
        padding: var(--bb-grid-size-2);
        margin: 0;

        & li {
          display: flex;
          align-items: center;
          margin-bottom: var(--bb-grid-size-2);

          a {
            color: var(--light-dark-n-0);
            display: flex;
            align-items: center;
          }

          & .g-icon {
            margin-left: var(--bb-grid-size-2);
          }

          img {
            width: 20px;
            height: 20px;
            object-fit: cover;
            border-radius: 50%;
            margin-right: var(--bb-grid-size-2);
            border: 1px solid var(--light-dark-n-90);
          }
        }
      }

      #token-counter,
      .token-usage-row {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-4);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family-mono, monospace);
        color: light-dark(var(--n-40), var(--n-80));

        & .g-icon {
          font-size: 20px;
        }

        & .token-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          border-right: 1px solid light-dark(var(--n-90), var(--n-30));
          padding-right: var(--bb-grid-size-4);

          &:last-child {
            border-right: none;
            padding-right: 0;
          }
        }

        & .token-label {
          font: 400 8px / 1 var(--bb-font-family);
          color: light-dark(var(--n-50), var(--n-60));
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        & .token-value {
          font-weight: 500;
          color: light-dark(var(--n-20), var(--n-90));
        }
      }

      #token-counter {
        background: light-dark(
          color-mix(in srgb, var(--n-98) 90%, transparent),
          color-mix(in srgb, var(--n-10) 90%, transparent)
        );
        border-bottom: 1px solid light-dark(var(--n-90), var(--n-30));
      }
    `,
  ];

  #openWorkItems = new Set<string>();
  #currentEntries: [string, ConsoleEntry][] = [];

  #renderInput() {
    const input = this.sca.controller.run.main.input;
    if (!input) {
      this.style.setProperty("--input-clearance", `0px`);
      return nothing;
    }

    return html`<bb-floating-input
      .schema=${input.schema}
      .focusWhenIn=${["canvas", "console"]}
      .disclaimerContent=${this.disclaimerContent}
      .neutral=${true}
    ></bb-floating-input>`;
  }

  #formatToSeconds(milliseconds: number) {
    const seconds = milliseconds / 1_000;
    const rounded = Math.round(seconds * 2) / 2;
    return `${rounded.toFixed(1)}s`;
  }

  #renderProducts(product: ProductMap) {
    if (product.size === 0) {
      return html`<div class="output" data-label="Output:">
        <p>There are no outputs for this step's work item</p>
      </div>`;
    }

    return html`<ul class="products">
      ${repeat(
        product,
        ([key]) => key,
        ([, item]) => {
          if (isConsoleUpdate(item)) {
            if (item.type === "text") {
              return html`<li class="output" data-label="${item.title}">
                <span class="g-icon filled round">${item.icon}</span>
                <bb-llm-output
                  .lite=${true}
                  .clamped=${false}
                  .value=${item.body}
                  .forceDrivePlaceholder=${true}
                ></bb-llm-output>
              </li>`;
            }
            if (item.type === "links") {
              return html`<li class="output" data-label="${item.title}">
                <span class="g-icon filled round">${item.icon}</span>
                <ul class="links-list">
                  ${item.links.map(
                    (link) => html`
                      <li>
                        <a
                          target="_blank"
                          href=${link.uri}
                          rel="noopener"
                          class="sans-flex w-500 round md-body-small"
                          ><img
                            src="https://www.google.com/s2/favicons?domain=${link.iconUri}&sz=48"
                          /><span>${link.title}</span
                          ><span class="g-icon inline filled round"
                            >open_in_new</span
                          ></a
                        >
                      </li>
                    `
                  )}
                </ul>
              </li>`;
            }
            if (item.type === "token-usage") {
              const net = item.promptTokenCount - item.cachedContentTokenCount;
              return html`<li class="output" data-label="${item.title}">
                <div class="token-usage-row">
                  <span class="g-icon round filled">${item.icon}</span>
                  <div class="token-group">
                    <span class="token-label">Requests</span>
                    <span class="token-value">${item.requestCount}</span>
                  </div>
                  <div class="token-group">
                    <span class="token-label">Input</span>
                    <span class="token-value">${item.promptTokenCount}</span>
                  </div>
                  <div class="token-group">
                    <span class="token-label">Cached</span>
                    <span class="token-value"
                      >${item.cachedContentTokenCount}</span
                    >
                  </div>
                  <div class="token-group">
                    <span class="token-label">Net Input</span>
                    <span class="token-value">${net}</span>
                  </div>
                  <div class="token-group">
                    <span class="token-label">Thoughts</span>
                    <span class="token-value">${item.thoughtsTokenCount}</span>
                  </div>
                  <div class="token-group">
                    <span class="token-label">Output</span>
                    <span class="token-value"
                      >${item.candidatesTokenCount}</span
                    >
                  </div>
                </div>
              </li>`;
            }
          }
          if ("processor" in item) {
            const { processor, receiver } = item;
            return html`<li>
              <section id="surfaces">
                <bb-a2ui-client-view
                  .processor=${processor}
                  .receiver=${receiver}
                  @a2uistatus=${(
                    evt: v0_8.Events.StateEvent<"a2ui.status">
                  ) => {
                    const STATUS_TO_TOAST: Record<string, ToastType> = {
                      pending: ToastType.PENDING,
                      success: ToastType.INFORMATION,
                      error: ToastType.ERROR,
                    };
                    this.sca.controller.global.toasts.toast(
                      evt.detail.message,
                      STATUS_TO_TOAST[evt.detail.status] ??
                        ToastType.INFORMATION,
                      false,
                      evt.detail.id
                    );
                  }}
                >
                </bb-a2ui-client-view>
              </section>
            </li>`;
          }

          return html`<li class="output" data-label="Output">
            <bb-llm-output
              .lite=${true}
              .clamped=${false}
              .value=${item}
              .forceDrivePlaceholder=${true}
            ></bb-llm-output>
          </li>`;
        }
      )}
    </ul>`;
  }

  #renderRun() {
    const runController = this.sca.controller.run.main;

    if (runController.console.size > 0) {
      this.#currentEntries = [...runController.console.entries()];
    }

    return html`<section id="console">
      ${repeat(
        this.#currentEntries,
        ([key]) => key,
        ([, item]) => {
          return html`
            ${item.work.size > 0
              ? repeat(
                  item.work.entries(),
                  ([key]) => key,
                  ([workItemId, workItem]) => {
                    if (
                      !this.sca.env.flags.get("showTokenCounter") &&
                      isTokenUsageOnly(workItem.product)
                    ) {
                      return nothing;
                    }
                    const icon = iconSubstitute(workItem.icon);

                    const workItemClasses: Record<string, boolean> = {
                      "w-400": true,
                      "sans-flex": true,
                      round: true,
                    };
                    if (typeof icon === "string" && icon) {
                      workItemClasses[icon] = true;
                    }

                    return html` <details
                      ?open=${workItem.awaitingUserInput ||
                      workItem.openByDefault ||
                      this.#openWorkItems.has(workItemId)}
                    >
                      <summary
                        @click=${(evt: Event) => {
                          if (
                            !(
                              evt.target instanceof HTMLElement &&
                              evt.target.parentElement instanceof
                                HTMLDetailsElement
                            )
                          ) {
                            return;
                          }

                          if (evt.target.parentElement.open) {
                            this.#openWorkItems.delete(workItemId);
                          } else {
                            this.#openWorkItems.add(workItemId);
                          }
                        }}
                        class=${classMap(workItemClasses)}
                      >
                        <span class="chevron g-icon round filled"></span>
                        <div class="step-detail">
                          ${icon
                            ? html`<span class="g-icon step-icon round filled"
                                >${icon}</span
                              >`
                            : nothing}<span class="title"
                            ><span class="title-text">${workItem.title}</span
                            ><span class="duration"
                              >${this.#formatToSeconds(workItem.elapsed)}</span
                            ></span
                          >
                        </div>
                      </summary>

                      ${workItem.awaitingUserInput
                        ? this.#renderInput()
                        : this.#renderProducts(workItem.product)}
                    </details>`;
                  }
                )
              : nothing}
            ${item.completed && !item.error
              ? item.output.size > 0
                ? repeat(
                    item.output.entries(),
                    ([key]) => key,
                    ([, item]) => {
                      return html`<div class="output" data-label="Output:">
                        ${hasControlPart(item)
                          ? `Skipped`
                          : html` <bb-llm-output
                              .lite=${true}
                              .clamped=${false}
                              .value=${item}
                              .forceDrivePlaceholder=${true}
                            ></bb-llm-output>`}
                      </div>`;
                    }
                  )
                : html`<div class="output" data-label="Output:">
                    <p>There are no outputs for this step</p>
                  </div>`
              : nothing}
            ${item.error
              ? html`<div class="step-error" data-label="Error:">
                  <p>${item.error.message}</p>
                </div>`
              : nothing}
          `;
        }
      )}
      ${runController.error
        ? html`<details class="error">
            <summary>Error</summary>
            ${runController.error.message}
          </details>`
        : nothing}
    </section>`;
  }

  #computeCumulativeTokenUsage(): {
    promptTokenCount: number;
    candidatesTokenCount: number;
    thoughtsTokenCount: number;
    cachedContentTokenCount: number;
    requestCount: number;
  } {
    let prompt = 0;
    let candidates = 0;
    let thoughts = 0;
    let cached = 0;
    let requests = 0;

    for (const [, entry] of this.#currentEntries) {
      const t = entry.tokenUsage;
      if (t) {
        prompt += t.promptTokenCount;
        candidates += t.candidatesTokenCount;
        thoughts += t.thoughtsTokenCount;
        cached += t.cachedContentTokenCount;
        requests += t.requestCount;
      }
    }
    return {
      promptTokenCount: prompt,
      candidatesTokenCount: candidates,
      thoughtsTokenCount: thoughts,
      cachedContentTokenCount: cached,
      requestCount: requests,
    };
  }

  render() {
    const showTokenCounter = !!this.sca.env.flags.get("showTokenCounter");
    const cumulativeTokens = showTokenCounter
      ? this.#computeCumulativeTokenUsage()
      : null;

    return html`<section id="container">
      ${[
        cumulativeTokens
          ? html`<div id="token-counter">
              <span class="g-icon round filled">token_auto</span>
              <div class="token-group">
                <span class="token-label">Requests</span>
                <span class="token-value"
                  >${cumulativeTokens.requestCount}</span
                >
              </div>
              <div class="token-group">
                <span class="token-label">Input</span>
                <span class="token-value"
                  >${cumulativeTokens.promptTokenCount}</span
                >
              </div>
              <div class="token-group">
                <span class="token-label">Cached</span>
                <span class="token-value"
                  >${cumulativeTokens.cachedContentTokenCount}</span
                >
              </div>
              <div class="token-group">
                <span class="token-label">Net Input</span>
                <span class="token-value"
                  >${cumulativeTokens.promptTokenCount -
                  cumulativeTokens.cachedContentTokenCount}</span
                >
              </div>
              <div class="token-group">
                <span class="token-label">Thoughts</span>
                <span class="token-value"
                  >${cumulativeTokens.thoughtsTokenCount}</span
                >
              </div>
              <div class="token-group">
                <span class="token-label">Output</span>
                <span class="token-value"
                  >${cumulativeTokens.candidatesTokenCount}</span
                >
              </div>
            </div>`
          : nothing,
        this.#renderRun(),
      ]}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-run-view": RunView;
  }
}
