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
import { GraphDescriptor, GraphProvider } from "@google-labs/breadboard";
import {
  NodePartialUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { EditorMode, filterConfigByMode } from "../../utils/mode.js";
import { classMap } from "lit/directives/class-map.js";
import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";

const MAXIMIZE_KEY = "bb-node-configuration-overlay-maximized";
const OVERLAY_CLEARANCE = 60;

@customElement("bb-node-configuration-overlay")
export class NodeConfigurationOverlay extends LitElement {
  @property()
  value: NodePortConfiguration | null = null;

  @property()
  graph: GraphDescriptor | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  @property()
  showTypes = false;

  @property({ reflect: true })
  maximized = false;

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

    h1 {
      width: 100%;
      display: flex;
      align-items: center;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
      margin: 0;
      text-align: left;
      border-bottom: 1px solid var(--bb-neutral-300);
      user-select: none;
      cursor: pointer;
    }

    h1::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-wrench) center center / 20px 20px
        no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    h1 span {
      flex: 1;
    }

    #content {
      width: 100%;
      max-height: none;
      flex: 1;
      overflow-y: auto;
    }

    #wrapper {
      min-width: 300px;
      width: max(40vw, 450px);
      min-height: 250px;
      height: max(50vh, 450px);
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: auto;
    }

    :host([maximized="true"]) #wrapper {
      width: 100% !important;
      flex: 1;
    }

    #container {
      padding: var(--bb-grid-size-4) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-4);
    }

    #buttons {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4) var(--bb-grid-size-4)
        var(--bb-grid-size-4);
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    #cancel {
      background: transparent;
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-right: var(--bb-grid-size-2);
    }

    #update {
      background: var(--bb-ui-500);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-6) var(--bb-grid-size-2)
        var(--bb-grid-size-3);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #update::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-check-inverted) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #update:hover,
    #update:focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }

    #minmax {
      width: 20px;
      height: 20px;
      border: none;
      padding: 0;
      margin: 0;
      font-size: 0;
      cursor: pointer;
      background: transparent var(--bb-icon-maximize) center center / 20px 20px
        no-repeat;
    }

    #minmax.maximized {
      background: transparent var(--bb-icon-minimize) center center / 20px 20px
        no-repeat;
    }

    form {
      display: grid;
      grid-template-rows: 16px 28px;
      row-gap: 4px;
      padding: 0 0 var(--bb-grid-size-4) 0;
      border-bottom: 1px solid var(--bb-neutral-300);
    }

    input[type="text"],
    select,
    textarea {
      padding: var(--bb-grid-size);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
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

  processData() {
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
      this.#formRef.value.querySelector<HTMLSelectElement>("#log-level");
    const descriptionEl =
      this.#formRef.value.querySelector<HTMLTextAreaElement>("#description");

    const metadata: NodeMetadata = {};
    if (titleEl?.value) metadata.title = titleEl.value;
    if (descriptionEl?.value) metadata.description = descriptionEl.value;
    if (logLevelEl?.value)
      metadata.logLevel = logLevelEl?.value as "info" | "debug";

    this.dispatchEvent(
      new NodePartialUpdateEvent(id, subGraphId, outputs, metadata)
    );
  }

  #toggleMaximize() {
    this.maximized = !this.maximized;

    globalThis.sessionStorage.setItem(MAXIMIZE_KEY, this.maximized.toString());
  }

  render() {
    if (!this.value || !this.value.ports) {
      return nothing;
    }

    const { inputs } = filterConfigByMode(this.value.ports, this.#editorMode());
    const ports = [...inputs.ports].sort((portA, portB) => {
      const isSchema =
        portA.name === "schema" ||
        portA.schema.behavior?.includes("ports-spec");
      return isSchema ? -1 : portA.name > portB.name ? 1 : -1;
    });

    const userInputs: UserInputConfiguration[] = ports.map((port) => {
      return {
        name: port.name,
        title: port.title,
        secret: false,
        configured: port.configured,
        value: structuredClone(port.value),
        schema: port.edges.length === 0 ? port.schema : undefined,
        status: port.status,
        type: port.schema.type,
      };
    });

    const contentLocationStart = { x: 0, y: 0 };
    const dragStart = { x: 0, y: 0 };
    const dragDelta = { x: 0, y: 0 };
    let dragging = false;

    return html`<bb-overlay
      @bboverlaydismissed=${(evt: Event) => {
        if (!this.#pendingSave) {
          return;
        }

        if (confirm("Close configurator without saving first?")) {
          return;
        }

        evt.stopImmediatePropagation();
      }}
      ${ref(this.#overlayRef)}
      inline
    >
      <div id="wrapper">
        <h1
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
          <span>Configure ${this.value.title}</span>
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
        </h1>
        <div id="content">
          <div id="container">
            <form
              ${ref(this.#formRef)}
              @submit=${(evt: Event) => {
                evt.preventDefault();
              }}
              @input=${() => {
                this.#pendingSave = true;
              }}
            >
              <label>Title</label>
              <input
                name="title"
                id="title"
                type="text"
                placeholder="Enter the title for this node"
                .value=${this.value.metadata?.title || ""}
              />

              <label>Log Level</label>
              <select type="text" id="log-level" name="log-level">
                <option
                  value="debug"
                  ?selected=${this.value.metadata?.logLevel === "debug"}
                >
                  Debug
                </option>
                <option
                  value="info"
                  ?selected=${this.value.metadata?.logLevel === "info"}
                >
                  Information
                </option>
              </select>

              <label>Description</label>
              <textarea
                id="description"
                name="description"
                placeholder="Enter the description for this node"
                .value=${this.value.metadata?.description || ""}
              ></textarea>
            </form>
            <bb-user-input
              ${ref(this.#userInputRef)}
              @input=${() => {
                this.#pendingSave = true;
              }}
              .inputs=${userInputs}
              .graph=${this.graph}
              .subGraphId=${this.value.subGraphId}
              .providers=${this.providers}
              .providerOps=${this.providerOps}
              .showTypes=${this.showTypes}
              .showTitleInfo=${true}
              .inlineControls=${true}
              .jumpTo=${this.value.selectedPort}
            ></bb-user-input>
          </div>
        </div>
        <div id="buttons">
          <button
            id="cancel"
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
          >
            Cancel
          </button>
          <button
            id="update"
            @click=${() => {
              this.processData();
            }}
          >
            Update
          </button>
        </div>
      </div>
    </bb-overlay>`;
  }
}
