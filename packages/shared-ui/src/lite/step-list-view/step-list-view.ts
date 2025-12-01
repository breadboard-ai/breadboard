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
import { LiteModeState, StepListStepState } from "../../state";
import { repeat } from "lit/directives/repeat.js";

@customElement("bb-step-list-view")
export class StepListView extends SignalWatcher(LitElement) {
  @property()
  accessor stepList: LiteModeState["stepList"] | null = null;

  @property()
  accessor status: LiteModeState["status"] | null = null;

  @property()
  accessor viewType: LiteModeState["viewType"] | null = null;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    Styles.HostColorsMaterial.baseColors,
    Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      @keyframes glide {
        from {
          background-position: bottom right;
        }

        to {
          background-position: top left;
        }
      }

      :host {
        display: block;
        flex: 1;
        color: var(--sys-color--on-surface);
      }

      section {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: start;

        & > h1 {
          color: var(--sys-color--on-surface);
          margin: 0;
        }

        & > p {
          color: var(--sys-color--on-surface);
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

                color: light-dark(#575b5f, #a2a9b0);
                border-radius: var(--bb-grid-size-4);
                background: light-dark(
                  #f0f4f9,
                  var(--sys-color--surface-container)
                );
                padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
                list-style: none;
                gap: var(--bb-grid-size-4);
                user-select: none;
                cursor: pointer;
                min-height: 48px;

                &.loading {
                  --light: oklch(
                    from var(--sys-color--surface-container-high) l c h / 20%
                  );
                  --dark: oklch(
                    from var(--sys-color--surface-container-high) l c h / 80%
                  );

                  background: linear-gradient(
                    123deg,
                    var(--light) 0%,
                    var(--dark) 25%,
                    var(--light) 50%,
                    var(--dark) 75%,
                    var(--light) 100%
                  );
                  background-size: 200% 200%;
                  animation: glide 2150ms linear infinite;
                }

                & .step-title {
                  color: var(--sys-color--on-surface);
                  padding-right: var(--bb-grid-size-4);
                }

                & .step-icon {
                  flex: 0 0 auto;
                }

                & > .marker-container {
                  flex: 0 0 auto;
                  position: relative;

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

                  & > .generating {
                    flex: 0 0 auto;
                    position: absolute;
                    font-size: 12px;
                    left: 4px;
                    top: 4px;
                    color: light-dark(var(--p-40), var(--p-80));
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
                border-radius: var(--bb-grid-size-3);
                border: 1px solid var(--sys-color--surface-variant);
                color: var(--sys-color--on-surface-variant);
                margin-top: var(--bb-grid-size-2);

                > p {
                  margin: 0;
                }

                & > .step-title {
                  color: var(--light-dark-n-70);
                  margin: 0 0 var(--bb-grid-size-2) 0;
                }
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
    const renderStep = (
      markerClasses: Record<string, boolean>,
      step: StepListStepState,
      status?: "generating" | "loading"
    ) => {
      if (status === "loading") {
        return html`<details>
          <summary
            inert
            class=${classMap({ loading: status === "loading" })}
          ></summary>
        </details>`;
      }

      return html`
        <details>
          <summary>
            <span class="marker-container">
              <span class=${classMap(markerClasses)}></span>
              ${status === "generating"
                ? html`<span class="generating g-icon filled-heavy round"
                    >pentagon</span
                  >`
                : nothing}
            </span>
            ${step.icon
              ? html`<span class="step-icon g-icon filled-heavy round"
                  >${step.icon}</span
                >`
              : nothing}
            <span class="step-title sans md-title-medium w-500"
              >${step.title}</span
            >
          </summary>
          <div class="step-content sans md-body-medium w-400">
            <h1 class="step-title w-400 md-body-small sans-flex">
              ${step.tags?.includes("input") ? "Question to user:" : "Prompt"}
            </h1>
            <p>
              ${step.prompt && step.prompt.trim() !== ""
                ? step.prompt
                : step.label
                  ? step.label
                  : html`Not provided`}
            </p>
          </div>
        </details>
      `;
    };

    const steps = this.stepList?.steps;
    if (!steps || steps.size === 0) {
      if (this.viewType === "loading") {
        return html`<ul id="list">
          ${repeat(new Array(4), () => {
            return html`<li>
              ${renderStep(
                {
                  marker: true,
                  "g-icon": true,
                  "filled-heavy": true,
                },
                {
                  label: "",
                  prompt: "",
                  status: "loading",
                  title: "",
                },
                "loading"
              )}
            </li>`;
          })}
        </ul>`;
      } else if (this.status === "generating") {
        return html`<ul id="list">
          <li>
            ${renderStep(
              {
                marker: true,
                "g-icon": true,
                "filled-heavy": true,
                working: true,
              },
              {
                label: "Thinking...",
                prompt: "",
                status: "pending",
                title: "Creating your app...",
              },
              "generating"
            )}
          </li>
        </ul>`;
      }
      return nothing;
    }

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

          return html`
            <li>
              ${step.status === "loading"
                ? renderPlaceholder()
                : renderStep(markerClasses, step)}
            </li>
          `;
        }
      )}
    </ul>`;
  }

  render() {
    return html`<section>
      ${[this.#renderTitle(), this.#renderList()]}
    </section>`;
  }
}
