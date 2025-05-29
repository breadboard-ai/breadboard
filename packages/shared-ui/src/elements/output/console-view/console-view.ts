/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../../strings/helper.js";
const Strings = StringsHelper.forSection("ActivityLog");

import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ProjectRun } from "../../../state";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { ResizeEvent, RunEvent } from "../../../events/events";
import { icons } from "../../../styles/icons";
import { SignalWatcher } from "@lit-labs/signals";

@customElement("bb-console-view")
export class ConsoleView extends SignalWatcher(LitElement) {
  @property()
  accessor run: ProjectRun | null = null;

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
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
          color: var(--bb-neutral-700);
          border-radius: var(--bb-grid-size-16);
          border: 1px solid var(--bb-neutral-500);
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

        &::after {
          content: "";
          display: block;
          height: calc(var(--input-clearance) + var(--bb-grid-size-6));
          width: 100%;
        }

        .output {
          position: relative;
          margin-top: var(--bb-grid-size-7);
          border-radius: var(--bb-grid-size-2);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          border: 1px solid var(--bb-neutral-200);
          color: var(--bb-neutral-900);
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);

          &::before {
            content: "Output:";
            position: absolute;
            left: var(--bb-grid-size-3);
            top: calc(var(--bb-grid-size-5) * -1);
            color: var(--bb-neutral-300);
          }

          & p {
            margin: 0;
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
            background: var(--bb-neutral-50);
            color: var(--bb-neutral-900);
            font: 500 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
            cursor: pointer;

            &::-webkit-details-marker {
              display: none;
            }

            & .title {
              flex: 1 1 auto;

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

              &.details-status::before {
                content: "keyboard_arrow_up";
              }
            }
          }

          &[open] > summary {
            margin-bottom: var(--bb-grid-size-3);

            & .g-icon.details-status::before {
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
            font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
              var(--bb-font-family);
            height: var(--bb-grid-size-12);
            background: var(--bb-neutral-200);
          }
        }
      }

      bb-floating-input {
        position: absolute;
        left: 50%;
        bottom: var(--bb-grid-size-6);
        translate: -50% 0;
        --container-margin: 0 var(--bb-grid-size-6);
      }
    `,
  ];

  #renderRunButton() {
    return html`<section id="no-console">
      <p id="waiting-message">${Strings.from("LABEL_WAITING_MESSAGE")}</p>
      <button
        id="run"
        @click=${() => {
          this.dispatchEvent(new RunEvent());
        }}
      >
        <span class="g-icon">spark</span>${Strings.from("COMMAND_START")}
      </button>
    </section>`;
  }

  #renderError() {
    if (!this.run) {
      return nothing;
    }

    return this.run.errors.size > 0
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
      : nothing;
  }

  #renderInput() {
    if (!this.run) {
      return nothing;
    }

    // Temporary while this is WIP.
    if (this.run) {
      return nothing;
    }

    return html`<bb-floating-input
      @bbresize=${(evt: ResizeEvent) => {
        this.style.setProperty(
          "--input-clearance",
          `${evt.contentRect.height}px`
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
    if (!this.run) {
      return nothing;
    }

    return html`<section id="console">
      ${repeat(this.run.console.entries(), ([, item]) => {
        const classes: Record<string, boolean> = {};
        if (item.icon) {
          classes[item.icon] = true;
        }

        console.log("OUTPUT", Array.from(item.output.entries()));

        return html`<details open>
          <summary class=${classMap(classes)}>${
            item.icon
              ? html`<span class="g-icon step-icon">${item.icon}</span>`
              : nothing
          }
            <span class="title">${item.title}</span>
            <span class="g-icon details-status"></span>
          </summary>
          ${
            item.work.size > 0
              ? repeat(item.work.entries(), ([, workItem]) => {
                  let duration: HTMLTemplateResult | symbol = nothing;
                  if (workItem.end) {
                    duration = html`${this.#formatToSeconds(
                      workItem.end - workItem.start
                    )}`;
                  }

                  const workItemClasses: Record<string, boolean> = {};
                  if (workItem.icon) {
                    workItemClasses[workItem.icon] = true;
                  }

                  return html` <details>
                    <summary class=${classMap(workItemClasses)}>
                      ${workItem.icon
                        ? html`<span class="g-icon step-icon"
                            >${workItem.icon}</span
                          >`
                        : nothing}<span class="title"
                        >${workItem.title}<span class="duration"
                          >${duration}</span
                        ></span
                      >

                      <span class="g-icon details-status"></span>
                    </summary>

                    ${workItem.product.size > 0
                      ? html`<ul class="products">
                          ${repeat(workItem.product, ([, product]) => {
                            return html`<li class="output">
                              <bb-llm-output
                                lite
                                .value=${product}
                              ></bb-llm-output>
                            </li>`;
                          })}
                        </ul>`
                      : html`<div class="output">
                          <p>There are no outputs for this step</p>
                        </div>`}
                  </details>`;
                })
              : html`<div class="output">
                  <p>There are no outputs for this step</p>
                </div>`
          }
        </details>
      </details>`;
      })}
    </section>`;
  }

  render() {
    return [
      html`<bb-header
        .replayActive=${this.run !== null}
        .progress=${0}
      ></bb-header>`,
      this.run ? this.#renderRun() : this.#renderRunButton(),
      this.#renderError(),
      this.#renderInput(),
    ];
  }
}
