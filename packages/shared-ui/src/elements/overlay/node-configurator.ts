/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  NodePortConfiguration,
  UserInputConfiguration,
} from "../../types/types.js";
import { Overlay } from "./overlay.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { UserInput } from "../elements.js";
import { BoardServer, GraphDescriptor } from "@google-labs/breadboard";
import {
  EnhanceNodeResetEvent,
  NodePartialUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { EditorMode, filterConfigByMode } from "../../utils/mode.js";
import { classMap } from "lit/directives/class-map.js";
import { NodeMetadata } from "@breadboard-ai/types";

const MAXIMIZE_KEY = "bb-node-configuration-overlay-maximized";
const OVERLAY_CLEARANCE = 60;

@customElement("bb-node-configuration-overlay")
export class NodeConfigurationOverlay extends LitElement {
  @property()
  canRunNode = false;

  @property()
  value: NodePortConfiguration | null = null;

  @property()
  graph: GraphDescriptor | null = null;

  @property()
  boardServers: BoardServer[] = [];

  @property()
  showTypes = false;

  @property({ reflect: true })
  maximized = false;

  @property()
  offerConfigurationEnhancements = false;

  @property()
  readOnly = false;

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
    }

    #wrapper {
      min-width: 410px;
      width: max(40vw, 450px);
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
        border: 1px solid var(--bb-neutral-300);
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
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
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

          height: 40px;
          border-bottom: 1px solid var(--bb-neutral-300);
          height: 40px;
          padding: 0 var(--bb-grid-size-3);

          display: flex;
          justify-content: flex-end;
          align-items: center;

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
                border: 1px solid var(--bb-neutral-300);
              }

              &:has(+ #log-level:checked)::after {
                background: var(--bb-icon-check) center center / 20px 20px
                  no-repeat;
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
        border-top: 1px solid var(--bb-neutral-300);
      }
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
      if (!this.#overlayRef.value || !this.value) {
        return;
      }

      const { contentBounds } = this.#overlayRef.value;

      // We scale up by 1/0.9 because the overlay has an initial scaling down
      // factor of 0.9 for its animation which we need to correct for.
      const width = contentBounds.width / 0.9;
      const height = contentBounds.height / 0.9;

      let { x, y } = this.value;
      if (this.value.addHorizontalClickClearance) {
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
    const metadata = this.value?.metadata;
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
      !this.value ||
      !this.value.ports ||
      !this.#formRef.value
    ) {
      return;
    }

    const outputs = this.#userInputRef.value.processData(true);
    if (!outputs) {
      return;
    }

    // Ensure that all expected values are set. If they are not set in the
    // outputs we assume that the user wants to remove the value.
    const { inputs } = filterConfigByMode(this.value.ports, this.#editorMode());
    for (const expectedInput of inputs.ports) {
      if (!outputs[expectedInput.name]) {
        outputs[expectedInput.name] = undefined;
      }
    }

    const { id, subGraphId } = this.value;
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
      new NodePartialUpdateEvent(id, subGraphId, outputs, metadata, debugging)
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
    if (!this.value || !this.value.ports) {
      return nothing;
    }

    const icon = (this.value.type ?? "configure")
      .toLocaleLowerCase()
      .replaceAll(/\s/gi, "-");
    const { inputs } = filterConfigByMode(this.value.ports, this.#editorMode());
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
        this.value?.nodeConfiguration &&
        this.value.nodeConfiguration[port.name]
      ) {
        value = this.value.nodeConfiguration[port.name];
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
            this.value?.type === "Model",
        },
      };
    });

    const contentLocationStart = { x: 0, y: 0 };
    const dragStart = { x: 0, y: 0 };
    const dragDelta = { x: 0, y: 0 };
    let dragging = false;

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
                .value=${this.value.metadata?.title || ""}
                ?disabled=${this.readOnly}
              />
              <label for="log-level">Show in app</label>
              <input
                type="checkbox"
                id="log-level"
                name="log-level"
                ?disabled=${this.readOnly}
                .checked=${this.value.metadata?.logLevel === "debug"}
              />

              <input
                id="description"
                name="description"
                placeholder="Enter the description for this component"
                .value=${this.value.metadata?.description || ""}
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
                  if (!this.value || !this.value.nodeConfiguration) {
                    return;
                  }

                  delete this.value.nodeConfiguration[evt.id];
                  this.requestUpdate();
                }}
                .nodeId=${this.value.id}
                .inputs=${userInputs}
                .graph=${this.graph}
                .subGraphId=${this.value.subGraphId}
                .boardServers=${this.boardServers}
                .showTypes=${this.showTypes}
                .showTitleInfo=${true}
                .inlineControls=${true}
                .jumpTo=${this.value.selectedPort}
                .enhancingValue=${false}
                .readOnly=${this.readOnly}
              ></bb-user-input>
            </div>
            <div class="container outputs">...</div>
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
