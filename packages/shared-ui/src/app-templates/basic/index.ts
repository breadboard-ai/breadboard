/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  LitElement,
  html,
  css,
  PropertyValues,
  nothing,
  HTMLTemplateResult,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  AppTemplate,
  AppTemplateOptions,
  TopGraphRunResult,
} from "../../types/types";
import Mode from "../shared/styles/icons.js";
import Animations from "../shared/styles/animations.js";

import { classMap } from "lit/directives/class-map.js";
import { GraphDescriptor, InspectableRun } from "@google-labs/breadboard";
import { styleMap } from "lit/directives/style-map.js";
import {
  InputEnterEvent,
  RunEvent,
  StopEvent,
  UtteranceEvent,
} from "../../events/events";
import { repeat } from "lit/directives/repeat.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { NodeValue, OutputValues } from "@breadboard-ai/types";
import { isLLMContentArrayBehavior, isLLMContentBehavior } from "../../utils";
import { extractError } from "../shared/utils/utils";

@customElement("app-basic")
export class Template extends LitElement implements AppTemplate {
  @property({ type: Object })
  accessor options: AppTemplateOptions = {
    title: "Untitled App",
    mode: "light",
    splashImage: false,
  };

  @property({ reflect: false })
  accessor run: InspectableRun | null = null;

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @property()
  accessor eventPosition = 0;

  @property()
  accessor pendingSplashScreen = false;

  get additionalOptions() {
    return {
      font: {
        values: [
          { title: "Sans-serif", value: "sans-serif" } /* Default */,
          { title: "Serif", value: "serif" },
        ],
        title: "Font",
      },
      fontStyle: {
        values: [
          { title: "Normal", value: "normal" } /* Default */,
          { title: "Italic", value: "italic" },
        ],
        title: "Font Style",
      },
    };
  }

  static styles = [
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      /** Fonts */

      @scope (.app-template) {
        :scope {
          --font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          --font-style: normal;
        }
      }

      @scope (.app-template.font-serif) {
        :scope {
          --font-family: serif;
        }
      }

      @scope (.app-template.fontStyle-italic) {
        :scope {
          --font-style: italic;
        }
      }

      /** General styles */

      @scope (.app-template) {
        :scope {
          background: var(--background-color);
          color: var(--text-color);
          display: flex;
          width: 100%;
          height: 100%;
          margin: 0;
        }

        & #content {
          display: flex;
          flex-direction: column;
          width: 100%;
          overflow-x: hidden;
          overflow-y: scroll;
          flex: 1;
          scrollbar-width: none;
          position: relative;

          &::before {
            content: "";
            width: 100svw;
          }

          &:has(.loading) {
            align-items: center;
            justify-content: center;
            background: var(--background-color);
          }

          .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100svw;
            height: 100svh;

            & .loading-message {
              display: flex;
              align-items: center;
              height: var(--bb-grid-size-8);
              padding-left: var(--bb-grid-size-8);
              background: var(--bb-progress) 4px center / 20px 20px no-repeat;
            }
          }

          #splash {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            flex: 1;
            animation: fadeIn 1s cubic-bezier(0, 0, 0.3, 1);

            &::before {
              content: "";
              width: 100%;
              flex: 1;
              background: var(--splash-image, url(/images/app/generic-flow.jpg))
                center center / cover no-repeat;
              mask-image: linear-gradient(
                to bottom,
                rgba(255, 0, 255, 1) 0%,
                rgba(255, 0, 255, 1) 70%,
                rgba(255, 0, 255, 0.75) 80%,
                rgba(255, 0, 255, 0.4) 90%,
                rgba(255, 0, 255, 0) 100%
              );
            }

            & h1 {
              background: var(--background-color, none);
              border-radius: var(--bb-grid-size-2);
              font: 500 var(--font-style) 32px / 42px var(--font-family);
              color: var(--primary-color, var(--bb-neutral-700));
              margin: 0 0 var(--bb-grid-size-3);
              flex: 0 0 auto;
              max-width: 80%;
              width: max-content;
              text-align: center;
            }

            & p {
              flex: 0 0 auto;
              font: 400 var(--font-style) var(--bb-body-large) /
                var(--bb-body-line-height-large) var(--font-family);
              color: var(--secondary-color, var(--bb-neutral-700));
              margin: 0 0 var(--bb-grid-size-3);

              max-width: 65%;
              width: max-content;
              text-align: center;
            }
          }

          & #controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 76px;
            border-bottom: 1px solid var(--secondary-color, var(--bb-neutral-0));
            padding: 0 var(--bb-grid-size-4);

            #progress {
              width: 100px;
              height: 4px;
              background: var(--secondary-color);
              border-radius: var(--bb-grid-size-16);
              position: relative;

              &::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: calc(var(--percentage) * 100%);
                max-width: 100%;
                height: 4px;
                background: var(--primary-color);
                border-radius: var(--bb-grid-size-16);
                transition: width 0.3s cubic-bezier(0, 0, 0.3, 1);
              }
            }

            button {
              width: 20px;
              height: 20px;
              background: transparent;
              border: none;
              font-size: 0;
              opacity: 0.6;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);

              &#back {
                background: var(--bb-icon-arrow-back) center center / 20px 20px
                  no-repeat;
              }

              &#share {
                background: var(--bb-icon-share) center center / 20px 20px
                  no-repeat;
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  opacity: 1;
                }
              }
            }

            div#share {
              width: 20px;
              height: 20px;
              background: transparent;
            }
          }

          & #activity {
            flex: 1;
            overflow: auto;

            display: flex;
            flex-direction: column;
            padding: var(--bb-grid-size-3);
            color: var(--text-color);

            &::before {
              flex: 1;
              content: "";
            }

            & bb-multi-output {
              --output-value-padding-x: var(--bb-grid-size-4);
              --output-value-padding-y: var(--bb-grid-size-4);
              --output-border-radius: var(--bb-grid-size-4);
              --output-font: 400 var(--bb-title-large) /
                var(--bb-title-line-height-large) var(--bb-font-family);
              --output-string-width: 95%;
              --output-string-margin-bottom-y: var(--bb-grid-size-3);
              --output-margin-bottom: var(--bb-grid-size-4);
              --output-background-color: var(--bb-neutral-0);
              flex: 1 0 auto;

              animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) forwards;
            }

            & .error {
              flex: 1 0 auto;
              display: flex;
              flex-direction: column;
              width: 80%;
              margin: 0 auto;

              & summary {
                list-style: none;
                cursor: pointer;

                & h1 {
                  margin: 0 0 var(--bb-grid-size-2) 0;
                  font: 400 var(--bb-title-large) /
                    var(--bb-title-line-height-large) var(--bb-font-family);
                  color: var(--primary-color);
                }

                & p {
                  font: 400 var(--bb-label-medium) /
                    var(--bb-label-line-height-medium) var(--bb-font-family);
                  margin: 0;
                  color: oklch(
                    from var(--text-color) l c h / calc(alpha - 0.6)
                  );
                }
              }

              & p {
                margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
                font: 400 var(--bb-title-medium) /
                  var(--bb-title-line-height-medium) var(--bb-font-family);
                color: var(--secondary-color);
              }

              &::-webkit-details-marker {
                display: none;
              }
            }

            & #status {
              position: absolute;
              display: flex;
              align-items: center;
              bottom: var(--bb-grid-size-6);
              width: calc(100% - var(--bb-grid-size-12));
              left: 50%;
              transform: translateX(-50%);
              background: var(--bb-progress) var(--primary-color) 16px center /
                20px 20px no-repeat;
              color: var(--primary-text-color);
              padding: var(--bb-grid-size-3) var(--bb-grid-size-4)
                var(--bb-grid-size-3) var(--bb-grid-size-12);
              border-radius: var(--bb-grid-size-3);
              z-index: 1;
              font: 400 var(--bb-title-medium) /
                var(--bb-title-line-height-medium) var(--bb-font-family);
              opacity: 0;
              animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) 0.6s forwards;

              &::after {
                content: "Working";
                flex: 0 0 auto;
                margin-left: var(--bb-grid-size-3);
                color: oklch(
                  from var(--primary-text-color) l c h / calc(alpha - 0.4)
                );
              }
            }
          }

          & #input {
            --user-input-padding-left: 0;

            display: flex;
            justify-content: center;
            position: relative;

            background: var(--background-color, var(--bb-neutral-0));

            & #run {
              min-width: 76px;
              height: var(--bb-grid-size-10);
              background: var(--primary-color, var(--bb-ui-50))
                var(--bb-add-icon-generative) 12px center / 16px 16px no-repeat;
              color: var(--primary-text-color, var(--bb-ui-700));
              border-radius: 20px;
              border: 1px solid var(--primary-color, var(--bb-ui-100));
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
              padding: 0 var(--bb-grid-size-5) 0 var(--bb-grid-size-9);
              opacity: 0.85;

              --transition-properties: opacity;
              transition: var(--transition);

              &.running {
                background: var(--bb-ui-500) url(/images/progress-ui.svg) 8px
                  center / 16px 16px no-repeat;
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  opacity: 1;
                }
              }
            }

            &.stopped {
              min-height: 100px;
              padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
            }

            &.finished {
              display: none;
            }

            &.paused,
            &.running {
              width: 100%;
              overflow: hidden;

              & #input-container {
                padding: var(--bb-grid-size-2) var(--bb-grid-size-3)
                  var(--bb-grid-size-4) var(--bb-grid-size-3);
                transition: transform 0.6s cubic-bezier(0, 0, 0.3, 1);
                transform: translateY(100%);
                background: var(--primary-color);
                color: var(--primary-text-color);
                width: 100%;
                display: flex;

                min-height: 100px;
                max-height: 385px;
                overflow: auto;

                & .user-input {
                  display: flex;
                  flex-direction: column;
                  flex: 1;

                  & p {
                    display: flex;
                    align-items: flex-end;
                    font: 400 var(--bb-title-medium) /
                      var(--bb-title-line-height-medium) var(--bb-font-family);
                    margin: 0 0 var(--bb-grid-size-3) 0;
                    flex: 1;
                  }

                  & textarea {
                    field-sizing: content;
                    resize: none;
                    background: transparent;
                    color: var(--primary-text-color);
                    font: 400 var(--bb-title-medium) /
                      var(--bb-title-line-height-medium) var(--bb-font-family);
                    border: none;
                    border-radius: var(--bb-grid-size-2);
                    outline: none;
                    width: 100%;
                    scrollbar-width: none;

                    &::placeholder {
                      color: oklch(
                        from var(--primary-text-color) l c h / calc(alpha - 0.3)
                      );
                    }
                  }
                }

                & .controls {
                  margin-left: var(--bb-grid-size-2);
                  display: flex;
                  align-items: flex-end;

                  & #continue {
                    margin-left: var(--bb-grid-size-2);
                    background: oklch(
                        from var(--primary-text-color) l c h /
                          calc(alpha - 0.75)
                      )
                      var(--bb-icon-send) center center / 20px 20px no-repeat;

                    width: 40px;
                    height: 40px;
                    font-size: 0;
                    border: none;
                    border-radius: 50%;

                    --transition-properties: opacity;
                    transition: var(--transition);

                    &[disabled] {
                      cursor: auto;
                      opacity: 0.5;
                    }

                    &:not([disabled]) {
                      cursor: pointer;
                      opacity: 0.5;

                      &:hover,
                      &:focus {
                        opacity: 1;
                      }
                    }
                  }
                }
              }

              &.active #input-container {
                transform: translateY(0);
              }
            }
          }
        }
      }
    `,
    Mode,
    Animations,
  ];

  #inputRef: Ref<HTMLDivElement> = createRef();
  #renderControls(topGraphResult: TopGraphRunResult) {
    if (topGraphResult.currentNode?.descriptor.id) {
      this.#nodesLeftToVisit.delete(topGraphResult.currentNode?.descriptor.id);
    }

    const showShare = "share" in navigator;
    const percentage =
      this.#totalNodeCount > 0
        ? (this.#totalNodeCount - this.#nodesLeftToVisit.size) /
          this.#totalNodeCount
        : 1;
    return html`<div id="controls">
      <button
        id="back"
        @click=${() => {
          this.dispatchEvent(new StopEvent(true));
        }}
      >
        Back
      </button>
      <div
        id="progress"
        style=${styleMap({ "--percentage": percentage.toFixed(2) })}
      ></div>
      ${showShare
        ? html`<button
            id="share"
            @click=${() => {
              navigator.share({
                url: window.location.href,
                title: this.options.title ?? "Untitled App",
              });
            }}
          >
            Share
          </button>`
        : html`<div id="share"></div>`}
    </div>`;
  }

  #renderActivity(topGraphResult: TopGraphRunResult) {
    let activityContents: HTMLTemplateResult | HTMLTemplateResult[] | symbol =
      nothing;

    const currentItem = topGraphResult.log.at(-1);
    if (currentItem?.type === "error") {
      activityContents = html`
        <details class="error">
          <summary>
            <h1>We are sorry, but there was a problem with this flow.</h1>
            <p>Tap for more details</p>
          </summary>
          <div>
            <p>${extractError(currentItem.error)}</p>
          </div>
        </details>
      `;
    }

    if (currentItem?.type === "edge" && topGraphResult.status === "paused") {
      // Attempt to find the most recent output. If there is one, show it
      // otherwise show any message that's coming from the edge.
      let lastOutput = null;
      for (let i = topGraphResult.log.length - 1; i >= 0; i--) {
        const result = topGraphResult.log[i];
        if (result.type === "edge" && result.descriptor?.type === "output") {
          lastOutput = result;
          break;
        }
      }

      // Render the output.
      if (lastOutput !== null) {
        activityContents = html`<bb-multi-output
          .outputs=${lastOutput.value ?? null}
        ></bb-multi-output>`;
      }
    } else if (topGraphResult.status === "running") {
      if (topGraphResult.currentNode?.descriptor.metadata?.title) {
        activityContents = html`<div id="status">
          ${topGraphResult.currentNode.descriptor.metadata.title}
        </div>`;
      }
    } else {
      // Find the last item.
      let lastOutput = null;
      for (let i = topGraphResult.log.length - 1; i >= 0; i--) {
        const result = topGraphResult.log[i];
        if (result.type === "edge" && result.value) {
          lastOutput = result;
          break;
        }
      }

      if (lastOutput !== null) {
        activityContents = html`<bb-multi-output
          .outputs=${lastOutput.value ?? null}
        ></bb-multi-output>`;
      }
    }

    return html`<div id="activity">${activityContents}</div>`;
  }

  #toLLMContentWithTextPart(text: string): NodeValue {
    return { role: "user", parts: [{ text }] };
  }

  #renderInput(topGraphResult: TopGraphRunResult) {
    const placeholder = html`<div class="user-input">
        <p>&nbsp;</p>
      </div>

      <div class="controls">
        <button id="continue" disabled>Continue</button>
      </div>`;

    const continueRun = (id: string) => {
      if (!this.#inputRef.value) {
        return;
      }

      const inputs = this.#inputRef.value.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea");
      const inputValues: OutputValues = {};
      for (const input of inputs) {
        if (input.dataset.type === "llm-content") {
          inputValues[input.name] = this.#toLLMContentWithTextPart(input.value);
        } else if (input.dataset.type === "llm-content-array") {
          inputValues[input.name] = [
            this.#toLLMContentWithTextPart(input.value),
          ];
        } else {
          inputValues[input.name] = input.value;
        }
      }

      this.dispatchEvent(
        new InputEnterEvent(id, inputValues, /* allowSavingIfSecret */ true)
      );
    };

    let inputContents: HTMLTemplateResult | symbol = nothing;
    let active = false;
    const currentItem = topGraphResult.log.at(-1);
    if (currentItem?.type === "edge") {
      const props = Object.entries(currentItem.schema?.properties ?? {});
      if (props.length > 0) {
        active = true;

        inputContents = html`
          ${repeat(props, ([name, schema]) => {
            const dataType = isLLMContentArrayBehavior(schema)
              ? "llm-content-array"
              : isLLMContentBehavior(schema)
                ? "llm-content"
                : "string";
            return html`<div class="user-input">
              <p>
                ${schema.description ? html`${schema.description}` : nothing}
              </p>

              <textarea
                placeholder="Type something"
                name=${name}
                type="text"
                data-type=${dataType}
              ></textarea>
            </div>`;
          })}

          <div class="controls">
            <bb-speech-to-text
              @bbutterance=${(evt: UtteranceEvent) => {
                if (!this.#inputRef.value) {
                  return;
                }

                const inputField =
                  this.#inputRef.value.querySelector<HTMLTextAreaElement>(
                    "textarea"
                  );
                if (!inputField) {
                  return;
                }

                inputField.value = evt.parts
                  .map((part) => part.transcript)
                  .join("");
              }}
            ></bb-speech-to-text>
            <button
              id="continue"
              @click=${() => {
                continueRun(currentItem.id ?? "unknown");
              }}
            >
              Continue
            </button>
          </div>
        `;
      } else {
        inputContents = placeholder;
      }
    } else {
      inputContents = placeholder;
    }

    let status: "stopped" | "paused" | "running" | "finished" =
      topGraphResult.status;

    if (topGraphResult.status === "stopped" && topGraphResult.log.length > 0) {
      status = "finished";
    }

    return html`<div
      @keydown=${(evt: KeyboardEvent) => {
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

        if (!(evt.key === "Enter" && isCtrlCommand)) {
          return;
        }

        continueRun("unknown");
      }}
      id="input"
      class=${classMap({ active, [status]: true })}
    >
      <div id="input-container" ${ref(this.#inputRef)}>${inputContents}</div>
    </div>`;
  }

  #totalNodeCount = 0;
  #nodesLeftToVisit = new Set<string>();
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("topGraphResult")) {
      if (
        this.graph &&
        this.topGraphResult &&
        (this.topGraphResult.log.length === 0 || this.#totalNodeCount === 0)
      ) {
        this.#nodesLeftToVisit = new Set(
          this.graph.nodes.map((node) => node.id)
        );

        this.#totalNodeCount = this.#nodesLeftToVisit.size;

        for (const item of this.topGraphResult.log) {
          if (item.type !== "node") {
            continue;
          }

          this.#nodesLeftToVisit.delete(item.descriptor.id);
        }
      }
    }
  }

  render() {
    const classes: Record<string, boolean> = {
      "app-template": true,
      [this.options.mode]: true,
    };

    if (!this.topGraphResult) {
      return nothing;
    }

    if (this.options.additionalOptions) {
      for (const [name, value] of Object.entries(
        this.options.additionalOptions
      )) {
        classes[`${name}-${value}`] = true;
      }
    }

    const styles: Record<string, string> = {};
    if (this.options.theme) {
      styles["--primary-color"] = this.options.theme.primaryColor;
      styles["--primary-text-color"] = this.options.theme.primaryTextColor;
      styles["--secondary-color"] = this.options.theme.secondaryColor;
      styles["--text-color"] = this.options.theme.textColor;
      styles["--background-color"] = this.options.theme.backgroundColor;
    }

    if (typeof this.options.splashImage === "string") {
      styles["--splash-image"] = this.options.splashImage;
    }

    if (
      typeof this.options.splashImage === "boolean" &&
      this.options.splashImage
    ) {
      if (!this.topGraphResult || this.topGraphResult.status === "stopped") {
        return html`<section
          class=${classMap(classes)}
          style=${styleMap(styles)}
        >
          <div id="content">
            <div class="loading"><p class="loading-message">Loading...</p></div>
          </div>
        </section>`;
      }
    }

    const splashScreen = html`
      <div id="splash">
        <h1>${this.options.title}</h1>
        ${this.options.description
          ? html`<p>${this.options.description}</p>`
          : nothing}
      </div>
      <div id="input" class="stopped">
        <div>
          <button
            id="run"
            ?disabled=${this.#totalNodeCount === 0}
            @click=${() => {
              this.dispatchEvent(new RunEvent());
            }}
          >
            Start
          </button>
        </div>
      </div>
    `;

    return html`<section class=${classMap(classes)} style=${styleMap(styles)}>
      <div id="content">
        ${(styles["--splash-image"] &&
          this.topGraphResult.status === "stopped" &&
          this.topGraphResult.log.length === 0) ||
        this.#totalNodeCount === 0
          ? splashScreen
          : [
              this.#renderControls(this.topGraphResult),
              this.#renderActivity(this.topGraphResult),
              this.#renderInput(this.topGraphResult),
            ]}
      </div>
    </section>`;
  }
}
