/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeMetadata } from "@breadboard-ai/types";
import {
  BoardServer,
  GraphDescriptor,
  InspectableRunNodeEvent,
  isImageURL,
  isLLMContent,
  isLLMContentArray,
  TemplatePart,
} from "@google-labs/breadboard";
import {
  css,
  html,
  HTMLTemplateResult,
  LitElement,
  nothing,
  PropertyValues,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { markdown } from "../../directives/markdown.js";
import {
  EnhanceNodeResetEvent,
  NodePartialUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { Project } from "../../state/types.js";
import {
  NodePortConfiguration,
  UserInputConfiguration,
} from "../../types/types.js";
import { EditorMode, filterConfigByMode } from "../../utils/mode.js";
import { UserInput } from "../elements.js";
import { Overlay } from "./overlay.js";

const MAXIMIZE_KEY = "bb-node-configuration-overlay-maximized";
const OVERLAY_CLEARANCE = 60;

@customElement("bb-node-configuration-overlay")
export class NodeConfigurationOverlay extends LitElement {
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

  @property()
  accessor projectState: Project | null = null;

  #overlayRef: Ref<Overlay> = createRef();
  #userInputRef: Ref<UserInput> = createRef();
  #formRef: Ref<HTMLFormElement> = createRef();
  #pendingSave = false;
  #onKeyDownBound = this.#onKeyDown.bind(this);

  #minimizedX = 0;
  #minimizedY = 0;
  #left: number | null = null;
  #top: number | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      z-index: 20;

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

    :host([maximized="true"]) {
      & #wrapper {
        width: 100%;
        height: 100%;
      }
    }

    #wrapper {
      min-width: 410px;
      width: max(25vw, 550px);
      min-height: 250px;
      height: max(70vh, 450px);
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: auto;
      container-type: size;

      & input[type="text"],
      & select,
      & textarea {
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        border: 1px solid var(--inner-border);
        border-radius: var(--bb-grid-size);
        height: var(--bb-grid-size-6);
      }

      textarea {
        resize: none;
        field-sizing: content;
        max-height: 300px;
      }

      & form {
        display: flex;
        flex-direction: column;
        height: 100%;

        & label {
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
        }

        & #title {
          flex: 1;
          margin-right: var(--bb-grid-size-6);
        }

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
          height: 40px;
          border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
          border-bottom: 1px solid var(--inner-border);
          height: 40px;
          padding: 0 var(--bb-grid-size-3);

          display: flex;
          justify-content: flex-end;
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

          &.display::before {
            background-image: var(--bb-icon-responsive-layout);
          }

          &.ask-user::before {
            background-image: var(--bb-icon-chat-mirror);
          }

          &.text::before {
            background-image: var(--bb-icon-text);
          }

          & > div {
            flex: 1;

            display: flex;
            justify-content: flex-start;
            align-items: center;

            & label[for="log-level"] {
              display: flex;
              align-items: center;

              &::after {
                margin-left: var(--bb-grid-size-2);
                content: "";
                display: block;
                width: 20px;
                height: 20px;
                border-radius: var(--bb-grid-size);
                border: 1px solid var(--inner-border);
                background: var(--bb-neutral-0);
              }

              &:has(+ #log-level:checked)::after {
                background: var(--bb-neutral-0) var(--bb-icon-check) center
                  center / 20px 20px no-repeat;
              }
            }

            & #log-level {
              display: none;
            }
          }

          & #minmax {
            width: 20px;
            height: 20px;
            border: none;
            padding: 0;
            margin: 0 0 0 var(--bb-grid-size-2);
            font-size: 0;
            cursor: pointer;
            background: transparent var(--bb-icon-maximize) center center / 20px
              20px no-repeat;

            &.maximized {
              background: transparent var(--bb-icon-minimize) center center /
                20px 20px no-repeat;
            }
          }
        }

        #content {
          width: 100%;
          max-height: none;
          flex: 1;
          overflow-y: auto;

          & .container {
            padding: var(--bb-grid-size-3);
          }
        }

        & footer {
          border-top: 1px solid var(--bb-neutral-300);
          height: 40px;
          padding: 0 var(--bb-grid-size-4);

          display: flex;
          justify-content: flex-end;
          align-items: center;

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

      & .outputs {
        border-top: 1px solid var(--inner-border, var(--bb-neutral-300));
        position: relative;

        &::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          height: 4px;
          width: 100%;
          background: var(--background);
        }

        & .no-outputs {
          font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family);
        }

        --output-border-width: 0;
        --output-border-radius: 0;
        --output-padding: var(--bb-grid-size-6);
        --output-value-margin-x: 0;
        --output-value-margin-y: 0;
        --output-value-padding-x: 0;
        --output-value-padding-y: 0;
      }

      bb-llm-output-array {
        padding-top: var(--bb-grid-size-8);
      }
    }

    bb-fast-access-menu {
      height: 300px;
      display: block;
      background: white;
      overflow: scroll;
    }

    :host([maximized="true"]) #wrapper {
      width: 100% !important;
      flex: 1;
    }
  `;

  #onKeyDown(evt: KeyboardEvent) {
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

    if (!(evt.key === "Enter" && isCtrlCommand)) {
      return;
    }

    this.processData();
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("keydown", this.#onKeyDownBound);
  }

  protected firstUpdated(): void {
    requestAnimationFrame(() => {
      if (!this.#overlayRef.value || !this.configuration) {
        return;
      }

      const { contentBounds } = this.#overlayRef.value;

      // We scale up by 1/0.9 because the overlay has an initial scaling down
      // factor of 0.9 for its animation which we need to correct for.
      const width = contentBounds.width / 0.9;
      const height = contentBounds.height / 0.9;

      let { x, y } = this.configuration;
      if (this.configuration.addHorizontalClickClearance) {
        x += OVERLAY_CLEARANCE;
      }

      y -= height / 2;

      if (x + width > window.innerWidth) {
        x = window.innerWidth - width - OVERLAY_CLEARANCE;
      }

      if (y + height > window.innerHeight) {
        y = window.innerHeight - height - OVERLAY_CLEARANCE;
      }

      if (y < 0) {
        y = OVERLAY_CLEARANCE;
      }

      this.#minimizedX = Math.round(x);
      this.#minimizedY = Math.round(y);

      this.#updateOverlayContentPositionAndSize();

      // Once we've calculated the minimized size we can now recall the user's
      // preferred max/min and use that.
      this.maximized =
        globalThis.sessionStorage.getItem(MAXIMIZE_KEY) === "true";
    });
  }

  protected updated(changedProperties: PropertyValues): void {
    if (!changedProperties.has("maximized")) {
      return;
    }

    this.#updateOverlayContentPositionAndSize();
  }

  #updateOverlayContentPositionAndSize() {
    if (!this.#overlayRef.value) {
      return;
    }

    if (this.maximized) {
      this.#overlayRef.value.style.setProperty(
        "--left",
        `${OVERLAY_CLEARANCE}px`
      );
      this.#overlayRef.value.style.setProperty(
        "--top",
        `${OVERLAY_CLEARANCE}px`
      );
      this.#overlayRef.value.style.setProperty(
        "--right",
        `${OVERLAY_CLEARANCE}px`
      );
      this.#overlayRef.value.style.setProperty(
        "--bottom",
        `${OVERLAY_CLEARANCE}px`
      );
    } else {
      let left = this.#minimizedX;
      let top = this.#minimizedY;

      if (this.#left !== null && this.#top !== null) {
        left = this.#left;
        top = this.#top;
      }

      this.#overlayRef.value.style.setProperty("--left", `${left}px`);
      this.#overlayRef.value.style.setProperty("--top", `${top}px`);
      this.#overlayRef.value.style.setProperty("--right", "auto");
      this.#overlayRef.value.style.setProperty("--bottom", "auto");
    }
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

  processData(debugging = false) {
    this.#pendingSave = false;

    if (
      !this.#userInputRef.value ||
      !this.configuration ||
      !this.configuration.ports ||
      !this.#formRef.value
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
    const titleEl =
      this.#formRef.value.querySelector<HTMLInputElement>("#title");
    const logLevelEl =
      this.#formRef.value.querySelector<HTMLInputElement>("#log-level");
    const descriptionEl =
      this.#formRef.value.querySelector<HTMLInputElement>("#description");

    const metadata: NodeMetadata = {};
    if (titleEl?.value) metadata.title = titleEl.value;
    if (descriptionEl?.value) metadata.description = descriptionEl.value;
    if (logLevelEl?.value)
      metadata.logLevel = logLevelEl?.checked ? "debug" : "info";

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

  #toggleMaximize() {
    this.maximized = !this.maximized;

    globalThis.sessionStorage.setItem(MAXIMIZE_KEY, this.maximized.toString());
  }

  #destroyCodeEditors() {
    if (!this.#userInputRef.value) {
      return;
    }

    this.#userInputRef.value.destroyEditors();
  }

  render() {
    if (!this.configuration || !this.configuration.ports) {
      return nothing;
    }

    const icon = (
      this.configuration.currentMetadata?.icon ??
      this.configuration.type ??
      "configure"
    )
      .toLocaleLowerCase()
      .replaceAll(/\s/gi, "-");
    const { inputs } = filterConfigByMode(
      this.configuration.ports,
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
          // TODO: Make this configurable.
          enhance:
            this.offerConfigurationEnhancements &&
            port.name === "persona" &&
            this.configuration?.type === "Model",
        },
      };
    });

    const contentLocationStart = { x: 0, y: 0 };
    const dragStart = { x: 0, y: 0 };
    const dragDelta = { x: 0, y: 0 };
    let dragging = false;

    let outputs: HTMLTemplateResult | symbol = nothing;
    const shouldShowOutputs =
      this.configuration.type?.toLocaleLowerCase() !== "input";
    if (shouldShowOutputs) {
      outputs = html`<div class="container outputs">
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
                      .values=${outputValue}
                    ></bb-llm-output-array>`;
                  } else if (isLLMContent(outputValue)) {
                    if (!outputValue.parts) {
                      // Special case for "$metadata" item.
                      // See https://github.com/breadboard-ai/breadboard/issues/1673
                      // TODO: Make this not ugly.
                      const data = (outputValue as unknown as { data: unknown })
                        .data;
                      value = html`<bb-json-tree .json=${data}></bb-json-tree>`;
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
          : html`<div class="no-outputs">No outputs created</div>`}
      </div>`;
    }

    return html`<bb-overlay
      @bboverlaydismissed=${(evt: Event) => {
        if (
          !this.#pendingSave ||
          confirm("Close configurator without saving first?")
        ) {
          this.#destroyCodeEditors();
          return;
        }

        evt.stopImmediatePropagation();
      }}
      ${ref(this.#overlayRef)}
      inline
    >
      <div id="wrapper">
        <form
          ${ref(this.#formRef)}
          @submit=${(evt: Event) => {
            evt.preventDefault();
          }}
          @input=${() => {
            this.#pendingSave = true;
          }}
        >
          <header
            class=${classMap({ [icon]: true })}
            @pointerdown=${(evt: PointerEvent) => {
              if (this.maximized) {
                return;
              }

              if (!(evt.target instanceof HTMLElement)) {
                return;
              }

              const bounds = this.#overlayRef.value?.contentBounds;
              if (!bounds) {
                return;
              }

              contentLocationStart.x = bounds.left;
              contentLocationStart.y = bounds.top;

              dragStart.x = evt.clientX;
              dragStart.y = evt.clientY;
              dragging = true;

              evt.target.setPointerCapture(evt.pointerId);
            }}
            @pointermove=${(evt: PointerEvent) => {
              if (!dragging) {
                return;
              }

              dragDelta.x = evt.clientX - dragStart.x;
              dragDelta.y = evt.clientY - dragStart.y;

              this.#left = contentLocationStart.x + dragDelta.x;
              this.#top = contentLocationStart.y + dragDelta.y;

              this.#updateOverlayContentPositionAndSize();
            }}
            @pointerup=${() => {
              dragging = false;
            }}
            @dblclick=${() => {
              this.#toggleMaximize();
            }}
          >
            <div>
              <input
                name="title"
                id="title"
                type="text"
                placeholder="Enter the title for this component"
                .value=${this.configuration.metadata?.title || ""}
                ?disabled=${this.readOnly}
                @pointerdown=${(evt: PointerEvent) => {
                  evt.stopImmediatePropagation();
                }}
                @dblclick=${(evt: Event) => {
                  evt.stopImmediatePropagation();
                }}
              />
              <label for="log-level">Show in app</label>
              <input
                type="checkbox"
                id="log-level"
                name="log-level"
                ?disabled=${this.readOnly}
                .checked=${this.configuration.metadata?.logLevel === "debug"}
              />

              <input
                id="description"
                name="description"
                placeholder="Enter the description for this component"
                .value=${this.configuration.metadata?.description || ""}
                type="hidden"
                ?disabled=${this.readOnly}
              />
            </div>
            <button
              id="minmax"
              title=${this.maximized ? "Minimize overlay" : "Maximize overlay"}
              class=${classMap({ maximized: this.maximized })}
              @click=${() => {
                this.#toggleMaximize();
              }}
            >
              ${this.maximized ? "Minimize" : "Maximize"}
            </button>
          </header>
          <div id="content">
            <div class="container">
              <bb-user-input
                ${ref(this.#userInputRef)}
                @input=${() => {
                  this.#pendingSave = true;
                }}
                @bbenhancenodereset=${(evt: EnhanceNodeResetEvent) => {
                  if (
                    !this.configuration ||
                    !this.configuration.nodeConfiguration
                  ) {
                    return;
                  }

                  delete this.configuration.nodeConfiguration[evt.id];
                  this.requestUpdate();
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
              ></bb-user-input>
            </div>
            ${outputs}
          </div>
          <footer>
            <button
              id="cancel"
              @click=${() => {
                this.dispatchEvent(new OverlayDismissedEvent());
              }}
            >
              Cancel
            </button>
            <button
              ?disabled=${this.readOnly}
              id="update"
              @click=${() => {
                this.processData();
              }}
            >
              Update
            </button>
          </footer>
        </form>
      </div>
    </bb-overlay>`;
  }
}
