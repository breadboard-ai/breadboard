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

/** To be kept in line with the CSS values below. */
const MAX_WIDTH = 400;
const OVERLAY_CLEARANCE = 40;

@customElement("bb-node-configuration-overlay")
export class NodeConfigurationOverlay extends LitElement {
  @property()
  configuration: NodePortConfiguration | null = null;

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
  #pendingSave = false;

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

    #content {
      width: 100%;
      max-height: none;
      flex: 1;
      overflow-y: auto;
    }

    #wrapper {
      min-width: 300px;
      width: 400px;
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
  `;

  protected firstUpdated(): void {
    requestAnimationFrame(() => {
      if (!this.#overlayRef.value || !this.configuration) {
        return;
      }

      const { contentHeight } = this.#overlayRef.value;
      let { x, y } = this.configuration;
      x += OVERLAY_CLEARANCE;
      y -= contentHeight / 2;

      if (x + MAX_WIDTH > window.innerWidth) {
        x = window.innerWidth - MAX_WIDTH - OVERLAY_CLEARANCE;
      }

      if (y + contentHeight > window.innerHeight) {
        y = window.innerHeight - contentHeight - OVERLAY_CLEARANCE;
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
        globalThis.sessionStorage.getItem("bb-node-configurator-maximized") ===
        "true";
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

  processData() {
    this.#pendingSave = false;

    if (
      !this.#userInputRef.value ||
      !this.configuration ||
      !this.configuration.port
    ) {
      return;
    }

    const outputs = this.#userInputRef.value.processData(true);
    if (!outputs) {
      return;
    }

    // The user has deleted the value, so here we will place an explicit
    // undefined value on the object so that the item is removed from the
    // configuration.
    if (Object.keys(outputs).length === 0) {
      outputs[this.configuration.port.name] = undefined;
    }

    const { id, subGraphId } = this.configuration;
    this.dispatchEvent(new NodePartialUpdateEvent(id, subGraphId, outputs));
  }

  render() {
    if (!this.configuration || !this.configuration.port) {
      return nothing;
    }

    const { port } = this.configuration;
    const inputs: UserInputConfiguration[] = [
      {
        name: port.name,
        title: port.title,
        secret: false,
        configured: port.configured,
        value: structuredClone(port.value),
        schema: port.edges.length === 0 ? port.schema : undefined,
        status: port.status,
        type: port.schema.type,
      },
    ];

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
            this.maximized = !this.maximized;

            globalThis.sessionStorage.setItem(
              "bb-node-configurator-maximized",
              this.maximized.toString()
            );
          }}
        >
          Configure ${this.configuration.port.title}
        </h1>
        <div id="content">
          <div id="container">
            <bb-user-input
              ${ref(this.#userInputRef)}
              @input=${() => {
                this.#pendingSave = true;
              }}
              @keydown=${(evt: KeyboardEvent) => {
                const isMac = navigator.platform.indexOf("Mac") === 0;
                const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

                if (!(evt.key === "Enter" && isCtrlCommand)) {
                  return;
                }

                this.processData();
              }}
              .inputs=${inputs}
              .graph=${this.graph}
              .subGraphId=${this.configuration.subGraphId}
              .providers=${this.providers}
              .providerOps=${this.providerOps}
              .showTypes=${this.showTypes}
              .showTitleInfo=${false}
              .inlineControls=${true}
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
