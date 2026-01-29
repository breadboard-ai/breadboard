/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as Styles from "../../styles/styles.js";
import { classMap } from "lit/directives/class-map.js";
import { LiteModeState, StepListStepState } from "../../state/index.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { hash } from "@breadboard-ai/utils";

@customElement("bb-step-list-view")
export class StepListView extends SignalWatcher(LitElement) {
  @property()
  accessor state: LiteModeState | null = null;

  @property({ type: Boolean, reflect: true })
  accessor lite = false;

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
              &.animated {
                animation: fadeIn 650ms ease-in-out 1 backwards;
              }

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

                /* Loading animation for lite mode (gray) */
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
                  display: flex;
                  flex-direction: column;
                  flex: 1 1 0;
                  min-width: 0;

                  & .step-title-text,
                  & .step-thought {
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                  }

                  & .step-thought {
                    color: var(--sys-color--on-surface-variant);
                  }
                }

                & .step-icon {
                  flex: 0 0 auto;
                }
              }

              /* Step type colors - only when not in lite mode */
              :host(:not([lite])) & > summary {
                /* Input steps (yellow) */
                &.chat_mirror {
                  background: var(--ui-get-input);
                  color: var(--n-0);
                }

                /* Display steps (blue) */
                &.responsive_layout,
                &.drive_presentation,
                &.sheets,
                &.web,
                &.docs {
                  background: var(--ui-display);
                  color: var(--n-0);
                }

                /* Generative steps (green) */
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

                &.loading {
                  /* Use n-30 gray for subtle visibility against non-lite background */
                  --light: oklch(from var(--n-80) l c h / 50%);
                  --dark: oklch(from var(--n-80) l c h / 80%);

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
              }

              /* Marker container styles - apply to all modes */
              & > summary > .marker-container {
                flex: 0 0 auto;
                position: relative;

                &:has(> .marker.processing-generation) {
                  width: 32px;
                  height: 32px;
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

                  &.processing-generation {
                    animation: none;
                    width: 32px;
                    height: 32px;

                    &::before {
                      content: "";
                      display: block;
                      width: 32px;
                      height: 32px;
                      animation: rotate 1s linear infinite;
                      background: url(/images/progress-md.svg) center center /
                        100% 100% no-repeat;
                      border-radius: 50%;
                    }
                  }
                }

                & > .generating {
                  flex: 0 0 auto;
                  position: absolute;
                  width: 20px;
                  height: 20px;
                  left: 6px;
                  top: 6px;
                  color: var(--sys-color--on-surface-variant);
                }
              }

              &[open]
                > summary
                > .marker-container
                > .marker:not(.pending):not(.working) {
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

                :host(:not([lite])) & {
                  background: var(--light-dark-n-100);
                }

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

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  #renderTitle() {
    return html`<h1 class="w-400 sans-flex md-title-medium">Steps</h1>`;
  }

  #lastStepListHash = 0;
  #renderList() {
    const renderStep = (
      markerClasses: Record<string, boolean>,
      step: StepListStepState,
      options: {
        status?: "generating" | "loading";
        animated?: boolean;
        animationDelay?: number;
        colorClass?: string;
      }
    ) => {
      if (options.status === "loading") {
        return html`<details>
          <summary
            inert
            class=${classMap({
              loading: options.status === "loading",
              [options.colorClass ?? ""]: !!options.colorClass,
            })}
          ></summary>
        </details>`;
      }

      const title =
        options.status !== "generating"
          ? html`<h1 class="step-title w-400 md-body-small sans-flex">
              ${step.tags?.includes("input")
                ? "Question to user:"
                : "Prompt summary"}
            </h1>`
          : nothing;

      const animationDelay = `${
        options.animated ? (options.animationDelay ?? 0) : 0
      }ms`;
      return html`
        <details
          ?inert=${options.status === "generating"}
          class=${classMap({
            animated: options.animated === true,
          })}
          style=${styleMap({
            animationDelay,
          })}
        >
          <summary class=${step.icon ?? ""}>
            <span class="marker-container">
              <span class=${classMap(markerClasses)}></span>
              ${options.status === "generating"
                ? html`<span class="generating g-icon filled-heavy round"
                    >pentagon</span
                  >`
                : nothing}
            </span>
            ${step.icon && options.status !== "generating"
              ? html`<span class="step-icon g-icon filled-heavy round"
                  >${step.icon}</span
                >`
              : nothing}
            <span class="step-title sans md-title-medium w-500">
              <span class="step-title-text">${step.title}</span>
              ${options.status === "generating"
                ? html`<span class="step-thought sans md-body-medium w-400"
                    >${step.label}</span
                  >`
                : nothing}
            </span>
          </summary>
          <div class="step-content sans md-body-medium w-400">
            ${title}
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

    const renderPlaceholders = () => {
      // Use first step's icon for color, or default to chat_mirror (yellow/input)
      const firstStepIcon = this.state?.steps?.size
        ? ([...this.state.steps.values()][0]?.icon ?? "chat_mirror")
        : "chat_mirror";
      return html`<ul id="list">
        ${this.state?.status === "generating"
          ? renderPlannerProgress(firstStepIcon)
          : nothing}
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
              { status: "loading", colorClass: firstStepIcon }
            )}
          </li>`;
        })}
      </ul>`;
    };

    const renderPlannerProgress = (iconClass: string = "chat_mirror") => {
      if (!this.state?.planner) {
        return nothing;
      }
      return html`<li>
        ${renderStep(
          {
            marker: true,
            "g-icon": true,
            "filled-heavy": true,
            "processing-generation": true,
          },
          {
            icon: iconClass,
            label: this.state?.planner.thought,
            prompt: "",
            status: "pending",
            title: this.state?.planner.status,
          },
          { status: "generating" }
        )}
      </li>`;
    };

    if (
      this.state?.viewType === "editor" &&
      this.state?.status === "generating"
    ) {
      return renderPlaceholders();
    }

    const steps = this.state?.steps;
    if (!steps || steps.size === 0) {
      if (this.state?.viewType === "loading") {
        return renderPlaceholders();
      } else if (this.state?.status === "generating") {
        return html`<ul id="list">
          ${renderPlannerProgress("chat_mirror")}
        </ul>`;
      }
      return nothing;
    }

    const stepsHash = hash([...steps]);
    const animated = this.#lastStepListHash !== stepsHash;
    return html`<ul id="list">
      ${repeat(
        steps,
        (entry) => entry[0],
        ([, step], idx) => {
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
                : renderStep(markerClasses, step, {
                    animated,
                    animationDelay: idx * 60,
                  })}
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
