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
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  NodePartialUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events";
import {
  NodePortConfiguration,
  UserInputConfiguration,
} from "../../types/types";
import {
  BoardServer,
  GraphDescriptor,
  InspectableRunNodeEvent,
  isImageURL,
  isLLMContent,
  isLLMContentArray,
} from "@google-labs/breadboard";
import { Project } from "../../state";
import { EditorMode, filterConfigByMode } from "../../utils/mode";
import { UserInput } from "../elements";
import { classMap } from "lit/directives/class-map.js";
import { TemplatePart } from "../../utils/template";
import { NodeMetadata } from "@breadboard-ai/types";
import { map } from "lit/directives/map.js";
import { markdown } from "../../directives/markdown";

@customElement("bb-focus-editor")
export class FocusEditor extends LitElement {
  @property({ reflect: true, type: Boolean })
  accessor active = false;

  @property()
  accessor canRunNode = false;

  @property()
  accessor configuration: NodePortConfiguration | null = null;

  @property()
  accessor runEventsForNode: InspectableRunNodeEvent[] | null = null;

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor showTypes = false;

  @property({ reflect: true })
  accessor maximized = false;

  @property()
  accessor offerConfigurationEnhancements = false;

  @property()
  accessor readOnly = false;

  @property({ reflect: true, type: Boolean })
  accessor hasOutputs = false;

  @property()
  accessor projectState: Project | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;

      --background: var(--bb-ui-50);
      --outer-border: var(--bb-ui-500);
      --inner-border: var(--bb-ui-300);
    }

    :host :has(header.generative),
    :host :has(header.generative-image),
    :host :has(header.generative-audio),
    :host :has(header.generative-code),
    :host :has(header.generative-text) {
      --background: var(--bb-generative-50);
      --outer-border: var(--bb-generative-600);
      --inner-border: var(--bb-generative-300);
    }

    :host :has(header.text),
    :host :has(header.input),
    :host :has(header.output),
    :host :has(header.combine-outputs) {
      --background: var(--bb-inputs-50);
      --outer-border: var(--bb-inputs-600);
      --inner-border: var(--bb-inputs-300);
    }

    :host([hasoutputs]) {
      & #container {
        & #content-container {
          max-width: 1440px;

          & #content {
            grid-template-columns: 3fr minmax(0, 2fr);

            & #text-editor {
              & header {
                border-radius: var(--bb-grid-size-2) 0 0 0;
              }
            }
          }
        }
      }
    }

    #container {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0);
      pointer-events: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;

      &.active {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.05);
        backdrop-filter: blur(4px);
        transition:
          opacity 0.35s cubic-bezier(0, 0, 0.3, 1),
          background 0.35s cubic-bezier(0, 0, 0.3, 1),
          backdrop-filter 0.35s cubic-bezier(0, 0, 0.3, 1);

        & #content-container {
          opacity: 1;
        }
      }

      & #content-container {
        display: block;
        background: var(--bb-neutral-0);
        border-radius: var(--bb-grid-size-2);
        border: 1px solid var(--outer-border);
        width: 85svw;
        max-width: 840px;
        height: 85svh;
        max-height: 980px;
        transform-origin: 0 0;

        & #content {
          display: grid;
          grid-template-columns: 1fr;
          width: 100%;
          height: 100%;
          opacity: 1;
          transition: opacity 0.15s 0.2s cubic-bezier(0, 0, 0.3, 1);

          & #text-editor {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: auto;
            scrollbar-width: none;

            & header {
              &::before {
                content: "";
                width: 20px;
                height: 20px;
                background: var(--bb-icon-wrench) center center / 20px 20px
                  no-repeat;
                margin-right: var(--bb-grid-size);
              }

              background: var(--background);
              height: var(--bb-grid-size-10);
              border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
              border-bottom: 1px solid var(--inner-border);
              width: 100%;
              padding: var(--bb-grid-size-3);

              & h1 {
                font: 400 var(--bb-label-large) /
                  var(--bb-label-line-height-large) var(--bb-font-family);
                margin: 0;
              }

              display: flex;
              align-items: center;

              &.generative::before {
                background-image: var(--bb-add-icon-generative);
              }

              &.generative-audio::before {
                background-image: var(--bb-add-icon-generative-audio);
              }

              &.generative-code::before {
                background-image: var(--bb-add-icon-generative-code);
              }

              &.generative-text::before {
                background-image: var(--bb-add-icon-generative-text);
              }

              &.generative-image::before {
                background-image: var(--bb-add-icon-generative-image);
              }

              &.input,
              &.output,
              &.combine-outputs,
              &.text {
                border-bottom: 1px solid var(--bb-input-300);
              }

              &.input::before {
                background-image: var(--bb-icon-input);
              }

              &.output::before {
                background-image: var(--bb-icon-output);
              }

              &.combine-outputs::before {
                background-image: var(--bb-icon-table-rows);
              }

              &.text::before {
                background-image: var(--bb-icon-text);
              }
            }

            & #user-input {
              flex: 1;
              overflow-x: hidden;
              overflow-y: scroll;
              padding: var(--bb-grid-size-3);
            }

            & footer {
              flex: 0 0 auto;
              height: var(--bb-grid-size-10);
              display: flex;
              align-items: center;
              justify-content: flex-end;
              padding: 0 var(--bb-grid-size-2);

              & #cancel {
                background: transparent;
                border: none;
                font: 400 var(--bb-label-medium) /
                  var(--bb-label-line-height-medium) var(--bb-font-family);
                color: var(--bb-neutral-500);
                margin-right: var(--bb-grid-size-2);
              }

              & #update {
                background: var(--bb-ui-500);
                border: none;
                border-radius: var(--bb-grid-size-16);
                color: var(--bb-neutral-0);

                display: flex;
                justify-content: flex-end;
                align-items: center;
                height: var(--bb-grid-size-6);

                font: 400 var(--bb-label-medium) /
                  var(--bb-label-line-height-medium) var(--bb-font-family);
                padding: 0 var(--bb-grid-size-4);
                transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
                opacity: 0.5;

                &:not([disabled]) {
                  opacity: 1;
                  cursor: pointer;

                  &:hover,
                  &:focus {
                    background: var(--bb-ui-600);
                    transition-duration: 0.1s;
                  }
                }
              }
            }
          }

          & #outputs {
            background: var(--bb-neutral-0);
            border-radius: 0 var(--bb-grid-size-2) var(--bb-grid-size-2) 0;
            border-left: 1px solid var(--inner-border);
            position: relative;
            color: var(--bb-neutral-700);
            font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
              var(--bb-font-family);
            overflow: auto;

            & #output-content {
              height: 100%;
              overflow: scroll;
              padding: var(--bb-grid-size-8) var(--bb-grid-size-3);
            }

            &::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 4px;
              height: 100%;
              background: var(--background);
            }

            --output-border-width: 0;
          }
        }

        &.hidden {
          & #content {
            opacity: 0;
            transition: opacity 0.15s cubic-bezier(0, 0, 0.3, 1);
          }
        }

        &.animating {
          transition: transform 0.35s cubic-bezier(0, 0, 0.3, 1);
        }
      }
    }
  `;

  #userInputRef: Ref<UserInput> = createRef();
  #contentRef: Ref<HTMLElement> = createRef();
  #containerRef: Ref<HTMLElement> = createRef();
  #state: "_initializing" | "inactive" | "expanding" | "collapsing" =
    "_initializing";
  #targetState: "_initializing" | "collapsed" | "expanded" | "inactive" =
    "_initializing";

  protected firstUpdated(): void {
    // Wait a frame to set this value after the initial update cycle.
    requestAnimationFrame(() => {
      this.#state = "inactive";
      this.#targetState = "inactive";
    });
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("active")) {
      if (this.#state !== "inactive") {
        return;
      }

      this.#targetState = this.active ? "expanded" : "collapsed";

      if (this.#targetState === "expanded") {
        this.#beginExpandAnimationIfNeeded();
      }

      if (this.#targetState === "collapsed") {
        this.#done();
      }
    }

    if (changedProperties.has("runEventsForNode")) {
      if (this.runEventsForNode && this.runEventsForNode.length > 0) {
        this.hasOutputs = true;
      }
    }
  }

  #done(processData = false) {
    if (processData) {
      this.processData();
    }
    this.#beginCollapseAnimationIfNeeded();
  }

  #beginExpandAnimationIfNeeded() {
    if (!this.#contentRef.value || !this.#containerRef.value) {
      return;
    }

    if (this.#state === "expanding") {
      return;
    }

    this.#containerRef.value.classList.add("active");
    this.#containerRef.value.style.opacity = "1";

    const first =
      this.configuration?.graphNodeLocation ??
      new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 1, 1);

    const last = this.#contentRef.value.getBoundingClientRect();
    const invert = {
      left: first.left - last.left,
      top: first.top - last.top,
      width: first.width / last.width,
      height: first.height / last.height,
    };

    this.#contentRef.value.style.transform = [
      `translateX(${invert.left}px)`,
      `translateY(${invert.top}px)`,
      `scale(${invert.width}, ${invert.height})`,
    ].join(" ");

    requestAnimationFrame(() => {
      if (!this.#contentRef.value) {
        return;
      }

      this.#state = "expanding";

      this.#contentRef.value.classList.remove("hidden");
      this.#contentRef.value.classList.add("animating");
      this.#contentRef.value.style.transform = "none";
      this.#contentRef.value.addEventListener(
        "transitionend",
        () => {
          if (!this.#contentRef.value) {
            return;
          }

          this.#state = "inactive";
          this.#targetState = "inactive";
          this.#contentRef.value.classList.remove("animating");
        },
        { once: true }
      );
    });
  }

  #beginCollapseAnimationIfNeeded() {
    if (!this.#contentRef.value || !this.#containerRef.value) {
      return;
    }

    if (this.#state === "collapsing") {
      return;
    }

    this.#state = "collapsing";

    const first =
      this.configuration?.graphNodeLocation ??
      new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 1, 1);
    const last = this.#contentRef.value.getBoundingClientRect();
    const invert = {
      left: first.left - last.left,
      top: first.top - last.top,
      width: first.width / last.width,
      height: first.height / last.height,
    };

    this.#containerRef.value.style.opacity = "0";
    this.#contentRef.value.classList.add("hidden");
    this.#contentRef.value.classList.add("animating");
    this.#contentRef.value.style.transform = [
      `translateX(${invert.left}px)`,
      `translateY(${invert.top}px)`,
      `scale(${invert.width}, ${invert.height})`,
    ].join(" ");

    this.#contentRef.value.addEventListener(
      "transitionend",
      () => {
        if (!this.#contentRef.value || !this.#containerRef.value) {
          return;
        }

        this.#state = "inactive";
        this.#targetState = "inactive";
        this.#contentRef.value.classList.remove("animating");
        this.#contentRef.value.style.transform = "";

        this.#containerRef.value.classList.remove("active");
        this.dispatchEvent(new OverlayDismissedEvent());
      },
      { once: true }
    );
  }

  processData(debugging = false) {
    if (
      !this.#userInputRef.value ||
      !this.configuration ||
      !this.configuration.ports
    ) {
      return;
    }

    const ins: TemplatePart[] = [];
    const outputs = this.#userInputRef.value.processData(true, (part) => {
      if (part.type === "in") {
        ins.push(part);
        // Always optimistically mark part as valid.
        delete part.invalid;
      }
      return part;
    });

    if (!outputs) {
      return;
    }

    // Ensure that all expected values are set. If they are not set in the
    // outputs we assume that the user wants to remove the value.
    const { inputs } = filterConfigByMode(
      this.configuration.ports,
      this.#editorMode()
    );
    for (const expectedInput of inputs.ports) {
      if (!outputs[expectedInput.name]) {
        outputs[expectedInput.name] = undefined;
      }
    }

    const { id, subGraphId } = this.configuration;
    const metadata: NodeMetadata = {};

    if (!debugging) {
      this.#destroyCodeEditors();
    }

    this.dispatchEvent(
      new NodePartialUpdateEvent(
        id,
        subGraphId,
        outputs,
        metadata,
        debugging,
        ins
      )
    );
  }

  #destroyCodeEditors() {
    if (!this.#userInputRef.value) {
      return;
    }

    this.#userInputRef.value.destroyEditors();
  }

  #editorMode(): EditorMode {
    const metadata = this.configuration?.metadata;
    if (!metadata || !metadata.visual) {
      return EditorMode.MINIMAL;
    }
    const visual = metadata.visual as {
      collapsed: "advanced";
    };
    if (visual.collapsed === "advanced") {
      return EditorMode.ADVANCED;
    }
    return EditorMode.MINIMAL;
  }

  render() {
    const icon = (
      this.configuration?.currentMetadata?.icon ??
      this.configuration?.type ??
      "configure"
    )
      .toLocaleLowerCase()
      .replaceAll(/\s/gi, "-");

    const { inputs } = filterConfigByMode(
      this.configuration?.ports ?? {
        inputs: { ports: [], fixed: true },
        outputs: { ports: [], fixed: true },
        side: { ports: [], fixed: true },
        updating: false,
      },
      this.#editorMode()
    );
    const ports = [...inputs.ports].sort((portA, portB) => {
      const isSchema =
        portA.name === "schema" ||
        portA.schema.behavior?.includes("ports-spec");
      return isSchema ? -1 : portA.name > portB.name ? 1 : -1;
    });

    const userInputs: UserInputConfiguration[] = ports.map((port) => {
      // Use the overrides if they're set.
      let value = port.value;
      let hasValueOverride = false;
      if (
        this.configuration?.nodeConfiguration &&
        this.configuration.nodeConfiguration[port.name]
      ) {
        value = this.configuration.nodeConfiguration[port.name];
        hasValueOverride = true;
      }

      return {
        name: port.name,
        title: port.title,
        secret: false,
        configured: port.configured,
        value: structuredClone(value),
        originalValue: hasValueOverride ? port.value : null,
        schema: port.edges.length === 0 ? port.schema : undefined,
        status: port.status,
        type: port.schema.type,
        offer: {
          enhance: false,
        },
      };
    });

    let outputs: HTMLTemplateResult | symbol = nothing;
    const shouldShowOutputs =
      this.configuration?.type?.toLocaleLowerCase() !== "input";
    if (shouldShowOutputs && this.hasOutputs) {
      outputs = html`<div id="outputs">
        <div id="output-content">
          ${this.runEventsForNode && this.runEventsForNode.length > 0
            ? html`${map(this.runEventsForNode, (evt) => {
                const { outputs } = evt;
                if (!outputs) {
                  return html`No value`;
                }

                return html`${map(Object.values(outputs), (outputValue) => {
                  let value: HTMLTemplateResult | symbol = nothing;
                  if (typeof outputValue === "object") {
                    if (isLLMContentArray(outputValue)) {
                      value = html`<bb-llm-output-array
                        .graphUrl=${this.graph?.url}
                        .clamped=${false}
                        .showModeToggle=${false}
                        .showEntrySelector=${false}
                        .showExportControls=${true}
                        .supportedExportControls=${{
                          drive: true,
                          clipboard: true,
                        }}
                        .values=${outputValue}
                      ></bb-llm-output-array>`;
                    } else if (isLLMContent(outputValue)) {
                      if (!outputValue.parts) {
                        // Special case for "$metadata" item.
                        // See https://github.com/breadboard-ai/breadboard/issues/1673
                        // TODO: Make this not ugly.
                        const data = (
                          outputValue as unknown as { data: unknown }
                        ).data;
                        value = html`<bb-json-tree
                          .json=${data}
                        ></bb-json-tree>`;
                      }

                      if (!outputValue.parts.length) {
                        value = html`No data provided`;
                      }

                      value = outputValue.parts.length
                        ? html`<bb-llm-output
                            .clamped=${false}
                            .graphUrl=${this.graph?.url}
                            .lite=${true}
                            .showExportControls=${true}
                            .supportedExportControls=${{
                              drive: true,
                              clipboard: true,
                            }}
                            .value=${outputValue}
                          ></bb-llm-output>`
                        : html`No data provided`;
                    } else if (isImageURL(outputValue)) {
                      value = html`<img src=${outputValue.image_url} />`;
                    } else {
                      value = html`<bb-json-tree
                        .json=${outputValue}
                      ></bb-json-tree>`;
                    }
                  } else {
                    let renderableValue: HTMLTemplateResult | symbol = nothing;
                    if (typeof outputValue === "string") {
                      renderableValue = html`${markdown(outputValue)}`;
                    } else {
                      renderableValue = html`${outputValue !== undefined
                        ? outputValue
                        : html`<span class="no-value"
                            >[No value provided]</span
                          >`}`;
                    }

                    // prettier-ignore
                    value = html`<div
                      class=${classMap({
                        value: true,
                      })}
                    >${renderableValue}</div>`;
                  }

                  return html` <div class="output-port">
                    <div class="value">${value}</div>
                  </div>`;
                })}`;
              })}`
            : html`<div class="outputs">No outputs available yet</div>`}
        </div>
      </div>`;
    }

    return html`<section
      id="container"
      ${ref(this.#containerRef)}
      @pointerdown=${() => {
        if (this.#state !== "inactive" || this.#targetState !== "inactive") {
          return;
        }

        this.active = false;
      }}
    >
      <div
        id="content-container"
        class="hidden"
        ${ref(this.#contentRef)}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
      >
        <div id="content">
          <div id="text-editor">
            <header class=${classMap({ [icon]: true })}>
              <h1>${this.configuration?.title}</h1>
            </header>
            <div id="user-input">
              ${this.configuration
                ? html`
                    <bb-user-input
                      ${ref(this.#userInputRef)}
                      @keydown=${(evt: KeyboardEvent) => {
                        const isMac = navigator.platform.indexOf("Mac") === 0;
                        const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

                        if (evt.key === "Enter" && isCtrlCommand) {
                          this.#done(true);
                        }
                      }}
                      .nodeId=${this.configuration.id}
                      .inputs=${userInputs}
                      .graph=${this.graph}
                      .subGraphId=${this.configuration.subGraphId}
                      .boardServers=${this.boardServers}
                      .showTypes=${this.showTypes}
                      .showTitleInfo=${true}
                      .inlineControls=${true}
                      .jumpTo=${this.configuration.selectedPort}
                      .enhancingValue=${false}
                      .projectState=${this.projectState}
                      .readOnly=${this.readOnly}
                      .llmInputStreamlined=${true}
                      .llmInputShowPartControls=${false}
                      .llmShowInlineControlsToggle=${false}
                    ></bb-user-input>
                  `
                : nothing}
            </div>
            <footer>
              <button
                id="cancel"
                @click=${() => {
                  this.#done();
                }}
              >
                Cancel
              </button>
              <button
                ?disabled=${this.readOnly}
                id="update"
                @click=${() => {
                  this.#done(true);
                }}
              >
                Update
              </button>
            </footer>
          </div>
          ${outputs}
        </div>
      </div>
    </section>`;
  }
}
