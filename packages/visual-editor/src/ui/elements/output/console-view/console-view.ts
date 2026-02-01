/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isParticle } from "../../../../particles/index.js";
import {
  ConsoleEntry,
  ConsoleUpdate,
  LLMContent,
  Particle,
  SimplifiedA2UIClient,
} from "@breadboard-ai/types";

type ProductMap = Map<
  string,
  LLMContent | Particle | SimplifiedA2UIClient | ConsoleUpdate
>;
import { SignalWatcher } from "@lit-labs/signals";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { ProjectRun } from "../../../state/index.js";
import { baseColors } from "../../../styles/host/base-colors.js";
import { type } from "../../../styles/host/type.js";
import { icons } from "../../../styles/icons.js";
import { iconSubstitute } from "../../../utils/icon-substitute.js";
import { sharedStyles } from "./shared-styles.js";
import { hasControlPart } from "../../../../runtime/control.js";

function isConsoleUpdate(
  item: LLMContent | Particle | SimplifiedA2UIClient | ConsoleUpdate
): item is ConsoleUpdate {
  return "type" in item && item.type === "text";
}

@customElement("bb-console-view")
export class ConsoleView extends SignalWatcher(LitElement) {
  @property()
  accessor run: ProjectRun | null = null;

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
        background: light-dark(var(--n-100), var(--n-15));
      }

      bb-header {
        border-top: 1px solid var(--light-dark-s-90, var(--light-dark-n-98));
      }

      #container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      #no-console {
        display: flex;
        flex-direction: column;
        height: 100%;
        align-items: center;
        justify-content: center;
        font: 400 var(--bb-body-large) / var(--bb-body-line-height-large)
          var(--bb-font-family);
        color: var(--light-dark-n-40);
        text-align: center;

        > p {
          margin: var(--bb-grid-size-3);
        }

        > #run {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 76px;
          height: var(--bb-grid-size-10);
          background: var(--primary-color, var(--light-dark-p-98))
            var(--start-icon, var(--bb-icon-generative)) 12px center / 16px 16px
            no-repeat;
          color: var(--light-dark-n-40, var(--light-dark-n-40));
          border-radius: var(--bb-grid-size-16);
          border: 1px solid var(--light-dark-n-60, var(--light-dark-n-98));
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-2);
          opacity: 0.8;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          & .g-icon {
            margin-right: var(--bb-grid-size);
          }

          &:not([disabled]) {
            cursor: pointer;

            &:focus,
            &:hover {
              opacity: 1;
            }
          }
        }
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

        .awaiting-user {
          display: flex;
          align-items: center;
          justify-content: center;
          font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);

          & .g-icon {
            margin-right: var(--bb-grid-size-2);
            animation: rotate 1s linear forwards infinite;
          }
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
            }

            & .title {
              display: flex;
              align-items: center;
              flex: 1 1 auto;

              & .g-icon {
                margin-left: var(--bb-grid-size);
                animation: rotate 1s linear forwards infinite;
              }

              & .duration {
                color: light-dark(var(--n-70), var(--n-80));
                margin-left: var(--bb-grid-size);
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

            &.active {
              &.g-icon.details-status {
                animation: rotate 1s linear forwards infinite;

                &::before {
                  content: "progress_activity";
                }
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

        & > details {
          & > summary {
            height: var(--bb-grid-size-12);
            background: light-dark(var(--n-98), var(--n-10));
            color: light-dark(var(--n-0), var(--n-100));

            & .title {
              flex: 0 1 auto;
            }

            &.chat_mirror {
              background: var(--ui-get-input);
              color: var(--n-0);
            }

            &.responsive_layout,
            &.drive_presentation,
            &.sheets,
            &.web,
            &.docs {
              background: var(--ui-display);
              color: var(--n-0);
            }

            &.spark,
            &.photo_spark,
            &.audio_magic_eraser,
            &.text_analysis,
            &.generative-image-edit,
            &.generative-code,
            &.videocam_auto,
            &.generative-search,
            &.generative,
            &.laps {
              background: var(--ui-generate);
              color: var(--n-0);
            }
          }
        }
      }

      bb-floating-input {
        --container-margin: 0;
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
    `,
  ];

  #openItems = new Set<string>();
  #openWorkItems = new Set<string>();
  #currentEntries: [string, ConsoleEntry][] = [];

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("run")) {
      this.#openItems.clear();
      this.#openWorkItems.clear();
    }
  }

  #renderInput() {
    const input = this.run?.input;
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
    const secondsValue = milliseconds / 1_000;
    const formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

    return `${formatter.format(secondsValue)}s`;
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
          // ConsoleUpdate (from ProgressWorkItem)
          if (isConsoleUpdate(item)) {
            return html`<li class="output" data-label="${item.title}:">
              <span class="g-icon filled round">${item.icon}</span>
              <bb-llm-output
                .lite=${true}
                .clamped=${false}
                .value=${item.body}
                .forceDrivePlaceholder=${true}
              ></bb-llm-output>
            </li>`;
          }
          // SimplifiedA2UIClient
          if ("processor" in item) {
            const { processor, receiver } = item;
            return html`<li>
              <section id="surfaces">
                <bb-a2ui-client-view
                  .processor=${processor}
                  .receiver=${receiver}
                >
                </bb-a2ui-client-view>
              </section>
            </li>`;
          }
          // Particle
          if (isParticle(item)) {
            return html`<li>
              <bb-particle-view .particle=${item}></bb-particle-view>
            </li>`;
          }
          // LLMContent (fallback)
          return html`<li class="output" data-label="Output:">
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
    if (!this.run) {
      return nothing;
    }

    // 1. If the signal provides a non-empty array, we update our cache. This
    //    way we avoid flashes of content when the console entries are reset.
    if (this.run.console.size > 0) {
      this.#currentEntries = [...this.run.console.entries()];
    }

    // 2. We then always use the cached version for rendering. If the signal
    //    was empty, this will be the previous, non-empty set of entries.
    return html`<section id="console">
      ${repeat(
        this.#currentEntries,
        ([key]) => key,
        ([itemId, item], idx) => {
          const empty =
            ((!item.completed && item.work.size === 0) ||
              (item.completed && item.output.size === 0)) &&
            !item.error;
          const classes: Record<string, boolean> = {
            "sans-flex": true,
            "w-500": true,
            round: true,
            "md-title-medium": true,
            empty,
            active: !item.completed,
          };
          if (item.icon) {
            classes[item.icon] = true;
          }

          if (item.tags) {
            for (const tag of item.tags) {
              if (tag === "output") {
                continue;
              }

              classes[tag] = true;
            }
          }

          const isLastItem = idx + 1 === this.run?.estimatedEntryCount;
          const isOpen = item.open || this.#openItems.has(itemId) || isLastItem;

          return html`<details ?open=${isOpen} disabled>
          <summary @click=${(evt: Event) => {
            if (
              !(
                evt.target instanceof HTMLElement &&
                evt.target.parentElement instanceof HTMLDetailsElement
              )
            ) {
              return;
            }

            // This is at the point of clicking, which means that
            // immediately afterwards the state will change. That,
            // in turn, means that we delete from the set when the
            // item is open, and add it when the item is currently
            // closed.
            if (evt.target.parentElement.open) {
              this.#openItems.delete(itemId);
            } else {
              this.#openItems.add(itemId);
            }
          }} class=${classMap(classes)}>
          <span class="chevron g-icon round filled"></span>
            <div class="step-detail">${
              item.icon
                ? html`<span class="g-icon step-icon round filled"
                    >${item.icon}</span
                  >`
                : nothing
            }
              <span class="title">${item.title}</span>
            </div>
            <bb-node-run-control
                    .actionContext=${"console"}
                    .nodeId=${itemId}
                    .runState=${item.status}
                  ></bb-node-run-control>
          </summary>
          ${
            item.work.size > 0
              ? repeat(
                  item.work.entries(),
                  ([key]) => key,
                  ([workItemId, workItem]) => {
                    const icon = iconSubstitute(workItem.icon);

                    const workItemClasses: Record<string, boolean> = {
                      "w-400": true,
                      "sans-flex": true,
                      round: true,
                    };
                    if (icon) {
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

                          // This is at the point of clicking, which means that
                          // immediately afterwards the state will change. That,
                          // in turn, means that we delete from the set when the
                          // item is open, and add it when the item is currently
                          // closed.
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
                            >${workItem.title}<span class="duration"
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
              : nothing
          }

          ${
            item.completed && !item.error
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
              : nothing
          }
          ${
            item.error
              ? html`<div class="step-error" data-label="Error:">
                  <p>${item.error.message}</p>
                </div>`
              : nothing
          }
        </details>
      </details>`;
        }
      )}
      ${this.run.error
        ? html`<details class="error">
            <summary>Error</summary>
            ${this.run.error.message}
          </details>`
        : nothing}
    </section>`;
  }

  render() {
    return html`<section id="container">
      ${[
        html`<bb-app-header
          .neutral=${true}
          .replayActive=${this.run?.consoleState === "entries"}
          .running=${this.run?.status === "running" ||
          this.run?.status === "paused"}
          .replayAutoStart=${true}
          .progress=${this.run?.progress}
        ></bb-app-header>`,
        this.#renderRun(),
      ]}
    </section>`;
  }
}
