/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../../strings/helper.js";
const Strings = StringsHelper.forSection("ActivityLog");

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ProjectRun } from "../../../state";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { ResizeEvent, StateEvent } from "../../../events/events";
import { icons } from "../../../styles/icons";
import { SignalWatcher } from "@lit-labs/signals";
import { isParticle } from "@breadboard-ai/particles";
import { sharedStyles } from "./shared-styles.js";
import { colorsLight } from "../../../styles/host/colors-light.js";
import { type } from "../../../styles/host/type.js";
import { iconSubstitute } from "../../../utils/icon-substitute.js";
import { styleMap } from "lit/directives/style-map.js";

@customElement("bb-console-view")
export class ConsoleView extends SignalWatcher(LitElement) {
  @property()
  accessor run: ProjectRun | null = null;

  @property()
  accessor themeStyles: Record<string, string> | null = null;

  @property()
  accessor disclaimerContent = "";

  static styles = [
    icons,
    sharedStyles,
    colorsLight,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      bb-header {
        border-top: 1px solid var(--s-90, var(--bb-neutral-100));
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
        color: var(--bb-neutral-700);
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
          background: var(--primary-color, var(--bb-ui-50))
            var(--start-icon, var(--bb-icon-generative)) 12px center / 16px 16px
            no-repeat;
          color: var(--n-40, var(--bb-neutral-700));
          border-radius: var(--bb-grid-size-16);
          border: 1px solid var(--n-60, var(--bb-neutral-500));
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

          summary {
            display: flex;
            align-items: center;
            height: var(--bb-grid-size-9);
            border-radius: var(--bb-grid-size-3);
            list-style: none;
            padding: 0 var(--bb-grid-size-3);
            background: var(--n-90, var(--bb-neutral-50));
            font-size: 12px;
            color: var(--n-0, var(--bb-neutral-900));
            cursor: pointer;

            > * {
              pointer-events: none;
              user-select: none;
            }

            &::-webkit-details-marker {
              display: none;
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
                color: var(--bb-neutral-700);
                margin-left: var(--bb-grid-size);
                font: 400 var(--bb-label-medium) /
                  var(--bb-label-line-height-medium) var(--bb-font-family);
              }
            }

            & .g-icon {
              flex: 0 0 auto;

              &.step-icon {
                margin-right: var(--bb-grid-size-2);
              }
            }

            &:not(.empty):not(.active) .g-icon {
              &.details-status::before {
                content: "keyboard_arrow_up";
              }
            }

            &.active .g-icon {
              &.details-status {
                animation: rotate 1s linear forwards infinite;

                &::before {
                  content: "progress_activity";
                }
              }
            }
          }

          &[open] > summary {
            margin-bottom: var(--bb-grid-size-3);

            &:not(.empty):not(.active) .g-icon.details-status::before {
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
            background: var(--n-90, var(--bb-neutral-200));

            &.chat_mirror {
              background: var(--ui-get-input);
            }

            &.responsive_layout,
            &.drive_presentation,
            &.sheets,
            &.web,
            &.docs {
              background: var(--ui-display);
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
            }
          }
        }
      }

      bb-floating-input {
        position: absolute;
        left: 50%;
        bottom: 0;
        padding-bottom: var(--bb-grid-size-6);
        translate: -50% 0;
        --s-90: var(--n-100);
        --container-margin: 0 var(--bb-grid-size-6);
        background: var(--n-100);
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

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("run")) {
      this.#openItems.clear();
      this.#openWorkItems.clear();
    }
  }

  #renderRunButton() {
    return html`<section id="no-console">
      <p id="waiting-message">${Strings.from("LABEL_WAITING_MESSAGE")}</p>
      <button
        id="run"
        @click=${() => {
          this.dispatchEvent(new StateEvent({ eventType: "board.run" }));
        }}
      >
        <span class="g-icon">spark</span>${Strings.from("COMMAND_START")}
      </button>
    </section>`;
  }

  #renderInput() {
    const input = this.run?.input;
    if (!input) {
      this.style.setProperty("--input-clearance", `0px`);
      return nothing;
    }

    const PADDING = 24;
    return html`<bb-floating-input
      .schema=${input.schema}
      .focusWhenIn=${["canvas", "console"]}
      .disclaimerContent=${this.disclaimerContent}
      @bbresize=${(evt: ResizeEvent) => {
        this.style.setProperty(
          "--input-clearance",
          `${evt.contentRect.height + PADDING}px`
        );
      }}
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

  #renderRun() {
    if (!this.run?.runnable) {
      return nothing;
    }

    return html`<section id="console">
      ${repeat(
        this.run.console.entries(),
        ([key]) => key,
        ([itemId, item], idx) => {
          const classes: Record<string, boolean> = {
            "sans-flex": true,
            "w-500": true,
            round: true,
            "md-title-medium": true,
            empty:
              (!item.completed && item.work.size === 0) ||
              (item.completed && item.output.size === 0),
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

          return html`<details ?open=${!item.completed || this.#openItems.has(itemId) || isLastItem}>
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
          }} class=${classMap(classes)}>${
            item.icon
              ? html`<span class="g-icon step-icon">${item.icon}</span>`
              : nothing
          }
            <span class="title">${item.title}</span>
            <span class="g-icon details-status"></span>
          </summary>
          ${
            item.work.size > 0
              ? repeat(
                  item.work.entries(),
                  ([key]) => key,
                  ([workItemId, workItem]) => {
                    const icon = iconSubstitute(workItem.icon);

                    const workItemClasses: Record<string, boolean> = {};
                    if (icon) {
                      workItemClasses[icon] = true;
                    }

                    return html` <details
                      ?open=${workItem.awaitingUserInput ||
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
                        ${icon
                          ? html`<span class="g-icon step-icon">${icon}</span>`
                          : nothing}<span class="title"
                          >${workItem.title}<span class="duration"
                            >${this.#formatToSeconds(workItem.elapsed)}</span
                          ></span
                        >

                        <span class="g-icon details-status"></span>
                      </summary>

                      ${workItem.awaitingUserInput
                        ? html`<div class="awaiting-user">
                            <span class="g-icon">progress_activity</span>
                            ${Strings.from("STATUS_AWAITING_USER")}
                          </div>`
                        : workItem.product.size > 0
                          ? html`<ul class="products">
                              ${repeat(
                                workItem.product,
                                ([key]) => key,
                                ([, product]) => {
                                  if (isParticle(product)) {
                                    return html`<li>
                                      <bb-particle-view
                                        .particle=${product}
                                      ></bb-particle-view>
                                    </li>`;
                                  }
                                  return html`<li
                                    class="output"
                                    data-label="Output:"
                                  >
                                    <bb-llm-output
                                      .lite=${true}
                                      .clamped=${false}
                                      .value=${product}
                                    ></bb-llm-output>
                                  </li>`;
                                }
                              )}
                            </ul>`
                          : html`<div class="output" data-label="Output:">
                              <p>
                                There are no outputs for this step's work item
                              </p>
                            </div>`}
                    </details>`;
                  }
                )
              : nothing
          }

          ${
            item.completed
              ? item.output.size > 0
                ? repeat(
                    item.output.entries(),
                    ([key]) => key,
                    ([, item]) => {
                      return html`<div class="output" data-label="Output:">
                        <bb-llm-output
                          .lite=${true}
                          .clamped=${false}
                          .value=${item}
                        ></bb-llm-output>
                      </div>`;
                    }
                  )
                : html`<div class="output" data-label="Output:">
                    <p>There are no outputs for this step</p>
                  </div>`
              : nothing
          }
        </details>
      </details>`;
        }
      )}
      ${this.run.errors.size > 0
        ? html`<details class="error">
            <summary>Errors</summary>
            ${repeat(
              this.run.errors,
              (id) => id,
              ([, runError]) => {
                return html`${runError.message}`;
              }
            )}
          </details>`
        : nothing}
    </section>`;
  }

  render() {
    return html`<section
      id="container"
      style=${styleMap(this.themeStyles ?? {})}
    >
      ${[
        html`<bb-app-header
          .neutral=${true}
          .replayActive=${this.run?.consoleState === "entries"}
          .progress=${this.run?.progress}
        ></bb-app-header>`,
        this.run?.consoleState === "entries"
          ? this.#renderRun()
          : this.#renderRunButton(),
        this.#renderInput(),
      ]}
    </section>`;
  }
}
