/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as Styles from "../../styles/styles";
import { classMap } from "lit/directives/class-map.js";
import { StepListState } from "../../state";
import { repeat } from "lit/directives/repeat.js";

@customElement("bb-step-list-view")
export class StepListView extends SignalWatcher(LitElement) {
  @property()
  accessor state: StepListState | null = null;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    Styles.HostColors.baseColors,
    Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: 1;
      }

      section {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: start;

        & > h1 {
          color: var(--light-dark-n-0);
          margin: 0;
        }

        & > p {
          color: light-dark(#575b5f, #ffffff);
          margin: 0 0 var(--bb-grid-size-2) 0;
        }

        & > #list {
          width: 100%;
          flex: 1 1 auto;
          overflow-x: hidden;
          overflow-y: scroll;
          scrollbar-width: none;

          list-style: none;
          display: flex;
          flex-direction: column;
          padding: 0;
          margin: 0;
          gap: var(--bb-grid-size-2);
          padding: var(--bb-grid-size-2) 0 var(--bb-grid-size-5) 0;
          mask: linear-gradient(
            to bottom,
            #ffffff00 0%,
            #ffffff var(--bb-grid-size-2),
            #ffffff calc(100% - var(--bb-grid-size-5)),
            #ff00ff00 100%
          );

          & > li {
            & > details {
              & > summary::-webkit-details-marker {
                display: none;
              }

              & > summary {
                display: flex;
                align-items: center;
                outline: none;

                color: light-dark(#575b5f, #ffffff);
                border-radius: var(--bb-grid-size-4);
                background: light-dark(#f0f4f9, #3d3f42);
                padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
                list-style: none;
                gap: var(--bb-grid-size-4);
                user-select: none;
                cursor: pointer;
                min-height: 48px;

                & .step-title {
                  color: var(--light-dark-n-0);
                  padding-right: var(--bb-grid-size-4);
                }

                & .step-icon {
                  flex: 0 0 auto;
                }

                & > .marker {
                  flex: 0 0 auto;

                  &::before {
                    content: "keyboard_arrow_down";
                  }

                  &.pending,
                  &.working {
                    animation: rotate 1s linear infinite;

                    &::before {
                      content: "progress_activity";
                    }
                  }
                }
              }

              &[open] > summary > .marker:not(.pending):not(.working) {
                &::before {
                  content: "keyboard_arrow_up";
                }
              }

              & > .step-content {
                padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
                border-radius: var(--bb-grid-size-2);
                border: 1px solid var(--light-dark-n-90);
                color: var(--light-dark-n-0);
                margin-top: var(--bb-grid-size-2);
              }
            }

            & .placeholder {
              display: flex;
              align-items: center;
              justify-content: center;

              color: light-dark(#575b5f, #ffffff);

              border-radius: var(--bb-grid-size-4);
              background: light-dark(#f0f4f9, #3d3f42);
              padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
              min-height: 48px;
            }
          }

          .pending {
            animation: rotate 1s linear infinite;
          }
        }
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

  #renderTitle() {
    return html`<h1 class="w-400 sans-flex md-title-medium">Steps</h1>`;
  }

  #renderList() {
    const steps = this.state?.steps;
    if (!steps || steps.size === 0) return nothing;
    return html`<ul id="list">
      ${repeat(
        steps,
        (entry) => entry[0],
        ([, step]) => {
          const markerClasses: Record<string, boolean> = {
            marker: true,
            "g-icon": true,
            "filled-heavy": true,
            [step.status]: true,
          };

          const renderPlaceholder = () => html`
            <div class="placeholder">
              <span class="g-icon filled-heavy round pending"
                >progress_activity<span> </span
              ></span>
            </div>
          `;

          const renderStep = () => html`
            <details>
              <summary>
                <span class=${classMap(markerClasses)}> </span>
                <span class="step-icon g-icon filled-heavy round"
                  >${step.icon}</span
                >
                <span class="step-title sans md-title-medium w-500"
                  >${step.title}</span
                >
              </summary>
              <div class="step-content sans md-body-medium w-400">
                ${step.prompt && step.prompt.trim() !== ""
                  ? step.prompt
                  : html`Not provided`}
              </div>
            </details>
          `;

          return html`
            <li>
              ${step.status === "loading" ? renderPlaceholder() : renderStep()}
            </li>
          `;
        }
      )}
    </ul>`;
  }

  render() {
    if (!this.state) return nothing;

    return html`<section>
      ${[this.#renderTitle(), this.#renderList()]}
    </section>`;
  }
}
