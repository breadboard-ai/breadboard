/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Overlay } from "./overlay.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  BoardInfoUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";

const MAXIMIZE_KEY = "bb-board-details-overlay-maximized";
const OVERLAY_CLEARANCE = 20;

@customElement("bb-board-details-overlay")
export class BoardDetailsOverlay extends LitElement {
  @property()
  boardTitle: string | null = null;

  @property()
  boardVersion: string | null = null;

  @property()
  boardDescription: string | null = null;

  @property()
  boardPublished: boolean | null = null;

  @property()
  boardIsTool: boolean | null = null;

  @property()
  boardIsComponent: boolean | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  location = { x: 100, y: 100, addHorizontalClickClearance: true };

  @property({ reflect: true })
  maximized = false;

  #formRef: Ref<HTMLFormElement> = createRef();

  #overlayRef: Ref<Overlay> = createRef();
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
      min-width: 410px;
      width: max(350px, 450px);
      min-height: 250px;
      height: 346px;
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: auto;
      container-type: size;
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

    #buttons > div {
      display: flex;
      flex: 0 0 auto;
    }

    #run-node {
      background: var(--bb-neutral-100);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #run-node::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-play-filled) center center / 20px
        20px no-repeat;
      opacity: 0.4;
      margin-right: var(--bb-grid-size);
    }

    #run-node:not([disabled]):hover,
    #run-node:not([disabled]):focus {
      background: var(--bb-neutral-300);
      transition-duration: 0.1s;
    }

    #run-node[disabled] {
      opacity: 0.3;
      cursor: initial;
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
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-2);
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
      grid-template-columns: 90px auto;
      grid-template-rows: var(--bb-grid-size-7);
      align-items: center;
      row-gap: var(--bb-grid-size-2);
      padding: 0 0 var(--bb-grid-size-4) 0;
      column-gap: var(--bb-grid-size-4);
    }

    input[type="checkbox"] {
      margin: 0;
    }

    .additional-items label[for="is-tool"],
    .additional-items label[for="is-component"] {
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
      margin: 0 0 0 var(--bb-grid-size-2);
      display: flex;
      align-items: center;
    }

    .additional-items {
      display: flex;
      align-items: center;
      height: 20px;
    }

    @container (min-width: 600px) {
      form {
        grid-template-columns: 90px auto 90px auto;
        grid-template-rows: var(--bb-grid-size-7);
        column-gap: var(--bb-grid-size-4);
      }

      form textarea {
        grid-column: 2/5;
      }

      label[for="log-level"] {
        justify-self: end;
      }

      label.component {
        grid-column: 1/2;
      }

      .additional-items {
        grid-column: 2/5;
      }
    }

    input[type="text"],
    select,
    textarea {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
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

    bb-user-input {
      padding-top: var(--bb-grid-size-4);
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
      if (!this.#overlayRef.value) {
        return;
      }

      const { contentBounds } = this.#overlayRef.value;

      // We scale up by 1/0.9 because the overlay has an initial scaling down
      // factor of 0.9 for its animation which we need to correct for.
      const width = contentBounds.width / 0.9;
      const height = contentBounds.height / 0.9;

      let { x, y } = this.location;
      if (this.location.addHorizontalClickClearance) {
        x += OVERLAY_CLEARANCE;
      }

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

  processData() {
    this.#pendingSave = false;

    if (!this.#formRef.value) {
      return;
    }

    const data = new FormData(this.#formRef.value);
    this.dispatchEvent(
      new BoardInfoUpdateEvent(
        data.get("title") as string,
        data.get("version") as string,
        data.get("description") as string,
        data.get("status") as "published" | "draft" | null,
        data.get("tool") === "on",
        data.get("component") === "on",
        this.subGraphId
      )
    );
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

    return html`<bb-overlay
      @bboverlaydismissed=${(evt: Event) => {
        if (!this.#pendingSave || confirm("Close without saving first?")) {
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
          <span>Edit Board Information</span>
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
              <label for="title">Title</label>
              <input
                id="title"
                name="title"
                type="text"
                required
                .value=${this.boardTitle || ""}
              />

              <label for="version">Version</label>
              <input
                id="version"
                name="version"
                pattern="\\d+\\.\\d+\\.\\d+"
                type="text"
                required
                .value=${this.boardVersion || ""}
              />

              <label for="description">Description</label>
              <textarea
                id="description"
                name="description"
                .value=${this.boardDescription || ""}
              ></textarea>

              <label for="status">Status</label>
              <select
                @input=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLSelectElement)) {
                    return;
                  }

                  if (this.boardPublished && evt.target.value !== "published") {
                    if (
                      !confirm(
                        "This board was published. Unpublishing it may break other boards. Are you sure?"
                      )
                    ) {
                      evt.preventDefault();
                      evt.target.value = "published";
                    }
                  }
                }}
                id="status"
                name="status"
                .value=${this.boardPublished ? "published" : "draft"}
              >
                <option value="draft" ?selected=${!this.boardPublished}>
                  Draft
                </option>
                <option value="published" ?selected=${this.boardPublished}>
                  Published
                </option>
              </select>

              <label class="component" for="is-component">Component</label>
              <div class="additional-items">
                <input
                  id="is-component"
                  name="component"
                  type="checkbox"
                  .value="on"
                  .checked=${this.boardIsComponent}
                />
                <label for="is-component"
                  >Show this in the Board Server Components list?</label
                >
              </div>

              <label for="is-tool">Tool</label>
              <div class="additional-items">
                <input
                  id="is-tool"
                  name="tool"
                  type="checkbox"
                  .value="on"
                  .checked=${this.boardIsComponent}
                />
                <label for="is-tool"
                  >Show this as a tool for Specialists?</label
                >
              </div>
            </form>
          </div>
        </div>
        <div id="buttons">
          <div>
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
      </div>
    </bb-overlay>`;
  }
}
