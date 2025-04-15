/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeConfiguration, NodeMetadata } from "@breadboard-ai/types";
import {
  BoardServer,
  GraphDescriptor,
  InspectableRunNodeEvent,
  TemplatePart,
} from "@google-labs/breadboard";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  GraphReplaceEvent,
  NodePartialUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events";
import { Project } from "../../state";
import {
  NodePortConfiguration,
  UserInputConfiguration,
} from "../../types/types";
import { isLLMContentBehavior } from "../../utils";
import { EditorMode, filterConfigByMode } from "../../utils/mode";
import { UserInput } from "../elements";
import "../../flow-gen/flowgen-in-step-button.js";
import type { FlowGenConstraint } from "../../flow-gen/flow-generator.js";
import * as StringsHelper from "../../strings/helper.js";
import { findConfigurationChanges } from "../../flow-gen/flow-diff.js";

const Strings = StringsHelper.forSection("Editor");

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

  @property()
  accessor projectState: Project | null = null;

  @state()
  accessor #generatedConfig: NodeConfiguration | null = null;

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

    :host([showoutputpane]) {
      & #container {
        & #content-container {
          max-width: 1240px;

          & #content {
            grid-template-columns: 3fr minmax(0, 3fr);

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
      pointer-events: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;

      &.active {
        pointer-events: auto;
        background: oklch(from var(--bb-neutral-900) l c h / 33%);
        transition:
          opacity 0.35s cubic-bezier(0, 0, 0.3, 1),
          background 0.35s cubic-bezier(0, 0, 0.3, 1);

        & #content-container {
          opacity: 1;
        }
      }

      & #content-container {
        display: flex;
        flex-direction: column;
        background: var(--bb-neutral-0);
        border-radius: var(--bb-grid-size-2);
        border: 1px solid var(--outer-border);
        width: 85svw;
        max-width: 800px;
        height: 85svh;
        min-height: 320px;
        max-height: 620px;
        transform-origin: 0 0;

        & header {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          background: var(--background);
          height: var(--bb-grid-size-10);
          border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
          border-bottom: 1px solid var(--inner-border);
          width: 100%;
          padding: var(--bb-grid-size-3);
          opacity: 1;
          transition: opacity 0.15s 0.2s cubic-bezier(0, 0, 0.3, 1);

          & h1 {
            flex: 1;
            display: flex;
            align-items: center;
            margin: 0;
            max-width: 80%;

            & input {
              font: 400 var(--bb-label-large) /
                var(--bb-label-line-height-large) var(--bb-font-family);
              background: transparent;
              padding: var(--bb-grid-size) var(--bb-grid-size);
              border: 1px solid transparent;
              border-radius: var(--bb-grid-size);
              field-sizing: content;
              max-width: 100%;
              min-width: 20%;

              &:hover,
              &:focus {
                border: 1px solid var(--outer-border);
              }
            }
          }

          bb-flowgen-in-step-button {
            z-index: 1;
            width: 24px;
            margin-left: auto;
            --background-size: 16px;
          }

          #run-node {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            flex: 1;

            & #run-isolated-node {
              width: 20px;
              height: 20px;
              border: none;
              opacity: 0.3;
              font-size: 0;
              background: transparent var(--bb-icon-play-arrow-filled) center
                center / 20px 20px no-repeat;

              &:not([disabled]) {
                cursor: pointer;
                opacity: 0.7;
              }
            }
          }

          &::before {
            content: "";
            width: 20px;
            height: 20px;
            background: var(--bb-icon-wrench) center center / 20px 20px
              no-repeat;
            margin-right: var(--bb-grid-size);
          }

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

        & #content {
          display: grid;
          grid-template-columns: 1fr;
          width: 100%;
          flex: 1 1 auto;
          opacity: 1;
          transition: opacity 0.15s 0.2s cubic-bezier(0, 0, 0.3, 1);
          overflow: hidden;

          & #text-editor {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow-x: hidden;
            overflow-y: scroll;

            & #user-input {
              flex: 1;
              padding: var(--bb-grid-size-3);
            }
          }

          & #outputs {
            background: var(--bb-neutral-0);
            border-radius: 0 var(--bb-grid-size-2) var(--bb-grid-size-2) 0;
            border-left: 1px solid var(--inner-border);
            position: relative;
            color: var(--bb-neutral-700);
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);
            overflow: auto;

            & .placeholder {
              margin-bottom: var(--bb-grid-size-4);

              &.audio {
                height: var(--bb-grid-size-8);
                border-radius: var(--bb-grid-size-16);
                background: var(--bb-neutral-100) var(--bb-icon-add-audio)
                  center center / 20px 20px no-repeat;
              }

              &.image {
                aspect-ratio: 4/3;
                background: var(--bb-neutral-100) var(--bb-icon-add-image)
                  center center / 20px 20px no-repeat;
                border-radius: var(--bb-grid-size);
                width: 80%;
                margin: 0 auto;
              }

              &.text {
                & .line {
                  background: var(--bb-neutral-100);
                  border-radius: var(--bb-grid-size-16);
                  width: 100%;
                  height: var(--bb-grid-size-3);
                  margin-bottom: 6px;

                  &.l1,
                  &.l4 {
                    width: 82%;
                  }

                  &.l2 {
                    width: 92%;
                  }

                  &.l3 {
                    width: 86%;
                  }

                  &.l5 {
                    width: 41%;
                  }
                }
              }
            }

            & #output-content {
              height: 100%;
              overflow-y: scroll;
              overflow-x: hidden;
              padding: var(--bb-grid-size-9) var(--bb-grid-size-4);

              & .no-outputs {
                margin-top: calc(var(--bb-grid-size-5) * -1);
              }
            }

            --output-border-width: 0;
          }
        }

        & footer {
          flex: 0 0 auto;
          height: var(--bb-grid-size-11);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--bb-grid-size-2);
          border-top: 1px solid var(--inner-border);
          opacity: 1;
          transition: opacity 0.15s 0.2s cubic-bezier(0, 0, 0.3, 1);

          & > div {
            display: flex;
            align-items: center;
          }

          & #cancel {
            background: transparent;
            border: none;
            font: 400 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
            color: var(--bb-neutral-500);
            margin-left: var(--bb-grid-size-2);
          }

          & #update {
            background: var(--bb-ui-500);
            border: none;
            border-radius: var(--bb-grid-size-16);
            color: var(--bb-neutral-0);

            display: flex;
            justify-content: flex-end;
            align-items: center;
            height: var(--bb-grid-size-7);

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

          & #toggle-output {
            background: var(--bb-neutral-0) var(--bb-icon-dock-to-right) 8px
              center / 20px 20px no-repeat;
            border: none;
            border-radius: var(--bb-grid-size-16);
            color: var(--bb-neutral-700);

            display: flex;
            justify-content: flex-end;
            align-items: center;
            height: var(--bb-grid-size-7);

            font: 400 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-8);
            transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
            opacity: 0.5;

            &:not([disabled]) {
              opacity: 1;
              cursor: pointer;

              &.active,
              &:hover,
              &:focus {
                background-color: var(--bb-neutral-100);
                transition-duration: 0.1s;
              }
            }
          }
        }

        &.hidden {
          & header,
          & #content,
          & footer {
            opacity: 0;
            transition: opacity 0.1s cubic-bezier(0, 0, 0.3, 1);
          }
        }

        &.animating {
          transition: transform 0.35s cubic-bezier(0, 0, 0.3, 1);
        }
      }
    }
  `;

  #onEscapeKeyPressBound = this.onEscapeKeyPress.bind(this);
  #userInputRef: Ref<UserInput> = createRef();
  #contentRef: Ref<HTMLElement> = createRef();
  #containerRef: Ref<HTMLElement> = createRef();
  #state: "_initializing" | "inactive" | "expanding" | "collapsing" =
    "_initializing";
  #targetState: "_initializing" | "collapsed" | "expanded" | "inactive" =
    "_initializing";

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#onEscapeKeyPressBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("keydown", this.#onEscapeKeyPressBound);
  }

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

      // We wait a frame here so that the content has time to render and then
      // we can measure its sizing for the expand animation.
      requestAnimationFrame(() => {
        if (this.#targetState === "expanded") {
          this.#beginExpandAnimationIfNeeded();
        }

        if (this.#targetState === "collapsed") {
          this.#done();
        }
      });
    }
  }

  onEscapeKeyPress(evt: KeyboardEvent) {
    if (evt.key !== "Escape") {
      return;
    }

    this.#done();
  }

  #done(processData = false) {
    if (processData) {
      this.processData();
    }
    this.#generatedConfig = null;
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
      !this.#contentRef.value ||
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
    const titleEl =
      this.#contentRef.value.querySelector<HTMLInputElement>("#title");

    const metadata: NodeMetadata = {};
    if (titleEl?.value) metadata.title = titleEl.value;

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
      if (this.#generatedConfig?.[port.name]) {
        value = this.#generatedConfig[port.name];
      } else if (
        this.configuration?.nodeConfiguration &&
        this.configuration.nodeConfiguration[port.name]
      ) {
        value = this.configuration.nodeConfiguration[port.name];
        hasValueOverride = true;
      }

      let title = port.title;
      if (port.title === "Instruction" && isLLMContentBehavior(port.schema)) {
        title = "";
      }

      return {
        name: port.name,
        title,
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
        @keydown=${(evt: KeyboardEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

          if (evt.key === "Enter" && isCtrlCommand) {
            this.#done(true);
          }
        }}
      >
        <header class=${classMap({ [icon]: true })}>
          <h1>
            <input
              id="title"
              name="title"
              .value=${this.configuration?.title}
            />
          </h1>
          ${this.graph && this.configuration?.id
            ? html`<bb-flowgen-in-step-button
                popoverPosition="below"
                .label=${Strings.from("COMMAND_DESCRIBE_EDIT_STEP")}
                .currentGraph=${this.graph satisfies GraphDescriptor}
                .constraint=${{
                  kind: "EDIT_STEP_CONFIG",
                  stepId: this.configuration?.id,
                } satisfies FlowGenConstraint}
                @bbgraphreplace=${this.#onFlowgenEdit}
              ></bb-flowgen-in-step-button>`
            : nothing}
        </header>
        <section id="content">
          <div id="text-editor">
            <div id="user-input">
              ${this.configuration
                ? html`
                    <bb-user-input
                      ${ref(this.#userInputRef)}
                      .nodeId=${this.configuration.id}
                      .inputs=${userInputs}
                      .graph=${this.graph}
                      .subGraphId=${this.configuration.subGraphId}
                      .boardServers=${this.boardServers}
                      .showTypes=${false}
                      .showTitleInfo=${true}
                      .inlineControls=${true}
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
          </div>
        </section>
        <footer>
          <div>
            <button
              ?disabled=${this.readOnly}
              id="update"
              @click=${() => {
                this.#done(true);
              }}
            >
              Update
            </button>
            <button
              id="cancel"
              @click=${() => {
                this.#done();
              }}
            >
              Cancel
            </button>
          </div>
        </footer>
      </div>
    </section>`;
  }

  async #onFlowgenEdit(event: GraphReplaceEvent) {
    event.stopPropagation();
    const oldFlow = this.graph;
    const newFlow = event.replacement;
    if (!oldFlow || !newFlow) {
      return;
    }
    const allConfigChanges = findConfigurationChanges(oldFlow, newFlow);
    const thisChange = allConfigChanges.find(
      (change) => change.id && change.id === this.configuration?.id
    );
    if (!thisChange) {
      return;
    }
    this.#generatedConfig = thisChange.configuration;
    // TODO(aomarks) It seems that <bb-text-editor> does not re-render when its
    // value changes from the outside for some reason. This trick forces a full
    // re-render of that and any other input elements, which does seem to work.
    // Figure out what's going on and replace with something less hacky.
    const oldConfig = this.configuration;
    this.configuration = null;
    await this.updateComplete;
    this.configuration = oldConfig;
  }
}
