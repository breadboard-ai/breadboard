/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SettingsStore } from "../../types/types.js";
import { Overlay } from "./overlay.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { OverlayDismissedEvent } from "../../events/events.js";
import {
  GraphProvider,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
} from "@google-labs/breadboard";

const OVERLAY_CLEARANCE = 16;
const MAXIMIZE_KEY = "bb-board-activity-overlay-maximized";

@customElement("bb-board-activity-overlay")
export class BoardActivityOverlay extends LitElement {
  @property()
  run: InspectableRun | null = null;

  @property()
  location = { x: 10, y: 10 };

  @property()
  inputsFromLastRun: InspectableRunInputs | null = null;

  @property()
  settings: SettingsStore | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  @property()
  events: InspectableRunEvent[] | null = null;

  @property({ reflect: true })
  maximized = false;

  @state()
  debugEvent: InspectableRunEvent | null = null;

  #overlayRef: Ref<Overlay> = createRef();
  #wrapperRef: Ref<HTMLDivElement> = createRef();

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
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    h1 {
      width: 100%;
      height: var(--bb-grid-size-9);
      display: flex;
      align-items: center;
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: 0 var(--bb-grid-size-3);
      margin: 0;
      text-align: left;
      border-bottom: 1px solid var(--bb-neutral-300);
      user-select: none;
      cursor: grab;
    }

    h1::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-vital-signs) center center / 20px
        20px no-repeat;
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
      width: var(--width, 500px);
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: auto;
      height: var(--height, calc(100svh - 120px));
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

    #close {
      background: var(--bb-icon-close) center center / 20px 20px no-repeat;
      border: none;
      font-size: 0;
      color: var(--bb-neutral-500);
      width: 20px;
      height: 20px;
      cursor: pointer;
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

    #back-to-activity {
      background: var(--bb-ui-50) var(--bb-icon-arrow-back) 6px center / 20px
        20px no-repeat;
      border: none;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-ui-600);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-8);
      margin-right: var(--bb-grid-size-2);
      border-radius: 50px;
      cursor: pointer;
      transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
    }

    #back-to-activity:hover,
    #back-to-activity:focus {
      background-color: var(--bb-ui-100);
    }
  `;

  protected willUpdate(changedProperties: PropertyValues): void {
    if (!changedProperties.has("run")) {
      return;
    }

    this.debugEvent = null;
  }

  protected firstUpdated(): void {
    requestAnimationFrame(() => {
      if (!this.#overlayRef.value || !this.location) {
        return;
      }

      const { contentBounds } = this.#overlayRef.value;

      // We scale up by 1/0.9 because the overlay has an initial scaling down
      // factor of 0.9 for its animation which we need to correct for.
      const width = contentBounds.width / 0.9;
      const height = contentBounds.height / 0.9;

      let { x, y } = this.location;

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

      // Once we've calculated the minimized size we can now recall the user's
      // preferred max/min and use that.
      this.maximized =
        globalThis.sessionStorage.getItem(MAXIMIZE_KEY) === "true";

      this.#overlayRef.value.style.setProperty("--left", `${Math.round(x)}px`);
      this.#overlayRef.value.style.setProperty("--top", `${Math.round(y)}px`);
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

  #toggleMaximize() {
    this.maximized = !this.maximized;

    globalThis.sessionStorage.setItem(MAXIMIZE_KEY, this.maximized.toString());
  }

  render() {
    const contentLocationStart = { x: 0, y: 0 };
    const dragStart = { x: 0, y: 0 };
    const dragDelta = { x: 0, y: 0 };
    let dragging = false;

    const events = this.run?.events ?? [];
    const eventPosition = events.length - 1;

    return html`<bb-overlay ${ref(this.#overlayRef)} inline passthru>
      <div id="wrapper" ${ref(this.#wrapperRef)}>
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
          <span>Board Activity</span>
          ${this.debugEvent
            ? html`<button
                id="back-to-activity"
                @click=${() => {
                  this.debugEvent = null;
                }}
              >
                Back
              </button>`
            : nothing}
          <button
            id="close"
            @click=${() => {
              this.dispatchEvent(new OverlayDismissedEvent());
            }}
          >
            Close
          </button>
        </h1>
        <div id="content">
          <div id="container">
            ${this.debugEvent
              ? html` <bb-event-details
                  .event=${this.debugEvent}
                ></bb-event-details>`
              : html`<bb-activity-log
                  .run=${this.run}
                  .events=${events}
                  .eventPosition=${eventPosition}
                  .inputsFromLastRun=${this.inputsFromLastRun}
                  .showExtendedInfo=${true}
                  .settings=${this.settings}
                  .showLogTitle=${false}
                  .logTitle=${"Debug Board"}
                  .waitingMessage=${'Click "Debug Board" to get started'}
                  .providers=${this.providers}
                  .providerOps=${this.providerOps}
                  @pointerdown=${(evt: PointerEvent) => {
                    const [top] = evt.composedPath();
                    if (
                      !(top instanceof HTMLElement) ||
                      !top.dataset.messageId
                    ) {
                      return;
                    }
                    evt.stopImmediatePropagation();
                    const id = top.dataset.messageId;
                    const event = this.run?.getEventById(id);
                    if (!event) {
                      // TODO: Offer the user more information.
                      console.warn(`Unable to find event with ID "${id}"`);
                      return;
                    }
                    if (event.type !== "node") {
                      return;
                    }
                    this.debugEvent = event;
                  }}
                  name="Board"
                ></bb-activity-log>`}
          </div>
        </div>
      </div>
    </bb-overlay>`;
  }
}
