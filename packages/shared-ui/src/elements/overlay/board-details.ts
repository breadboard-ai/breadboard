/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Overlay } from "./overlay.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  BoardInfoUpdateEvent,
  OverlayDismissedEvent,
} from "../../events/events.js";

const MAXIMIZE_KEY = "bb-board-details-overlay-maximized";
const OVERLAY_CLEARANCE = 20;

@customElement("bb-board-details-overlay")
export class BoardDetailsOverlay extends LitElement {
  @property()
  accessor tabId: string | null = null;

  @property()
  accessor boardTitle: string | null = null;

  @property()
  accessor boardVersion: string | null = null;

  @property()
  accessor boardDescription: string | null = null;

  @property()
  accessor boardPublished: boolean | null = null;

  @property()
  accessor boardIsTool: boolean | null = null;

  @property()
  accessor boardIsComponent: boolean | null = null;

  @property()
  accessor boardPrivate: boolean | null = null;

  @property()
  accessor boardExported: boolean | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor moduleId: string | null = null;

  @property()
  accessor location = { x: 100, y: 100, addHorizontalClickClearance: true };

  @property({ reflect: true })
  accessor maximized = false;

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
      background: transparent var(--bb-icon-edit) center center / 20px 20px
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
      height: 288px;
      display: flex;
      flex-direction: column;
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
      height: var(--bb-grid-size-10);
      padding: 0 var(--bb-grid-size-4);
      border-top: 1px solid var(--bb-neutral-200);
      display: flex;
      align-items: center;
    }

    #buttons > div {
      display: flex;
      flex: 0 0 auto;
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
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: 0 var(--bb-grid-size-4);
      height: var(--bb-grid-size-6);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #update:hover,
    #update:focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }

    form {
      display: grid;
      grid-template-columns: 90px auto;
      grid-template-rows: var(--bb-grid-size-7);
      row-gap: var(--bb-grid-size-2);
      padding: 0 0 var(--bb-grid-size-4) 0;
      column-gap: var(--bb-grid-size-4);
    }

    form > label {
      margin-top: var(--bb-grid-size-2);
    }

    input[type="checkbox"] {
      margin: 0;
    }

    .additional-items label[for="is-tool"],
    .additional-items label[for="is-component"],
    .additional-items label[for="is-exported"] {
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
      margin: 0 0 0 var(--bb-grid-size-2);
      display: flex;
      align-items: center;
    }

    .additional-items {
      display: none;
      align-items: center;
      height: 20px;
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
      min-height: 120px;
      max-height: 300px;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    label[for="version"],
    label[for="status"],
    label[for="is-tool"],
    label[for="is-component"],
    #version,
    #status {
      display: none;
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
        this.tabId,
        data.get("title") as string,
        data.get("version") as string,
        data.get("description") as string,
        data.get("status") as "published" | "draft" | "private" | null,
        data.get("tool") === "on",
        data.get("component") === "on",
        this.subGraphId,
        this.moduleId,
        data.get("exported") === "on"
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
        >
          <span>Edit Details</span>
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
              <label for="title">Name</label>
              <input
                id="title"
                name="title"
                type="text"
                required
                .value=${this.boardTitle || ""}
              />

              ${this.moduleId === null
                ? html` <label for="version">Version</label>
                    <input
                      id="version"
                      name="version"
                      pattern="\\d+\\.\\d+\\.\\d+"
                      type="hidden"
                      required
                      .value=${this.boardVersion || ""}
                    />`
                : nothing}

              <label for="description">Description</label>
              <textarea
                id="description"
                name="description"
                .value=${this.boardDescription || ""}
              ></textarea>

              ${this.moduleId === null
                ? html` <label for="status">Status</label>
                    <select
                      @input=${(evt: Event) => {
                        if (!(evt.target instanceof HTMLSelectElement)) {
                          return;
                        }

                        if (
                          this.boardPublished &&
                          evt.target.value !== "published"
                        ) {
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
                      <option
                        value="published"
                        ?selected=${this.boardPublished}
                      >
                        Published
                      </option>
                      ${this.subGraphId
                        ? nothing
                        : html`
                            <option
                              value="private"
                              ?selected=${this.boardPrivate}
                            >
                              Private
                            </option>
                          `}
                    </select>

                    <label class="component" for="is-component"
                      >Component</label
                    >
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
                    </div>`
                : nothing}
              ${this.subGraphId || this.moduleId
                ? html`<label for="is-exported">Exported</label>
                    <div class="additional-items">
                      <input
                        id="is-exported"
                        name="exported"
                        type="checkbox"
                        .value="on"
                        .checked=${this.boardExported}
                      />
                      <label for="is-exported"
                        >Export this for use in other flows</label
                      >
                    </div>`
                : nothing}
            </form>
          </div>
        </div>
        <div id="buttons">
          <div>
            <button
              id="update"
              @click=${() => {
                this.processData();
              }}
            >
              Update
            </button>
            <button
              id="cancel"
              @click=${() => {
                this.dispatchEvent(new OverlayDismissedEvent());
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </bb-overlay>`;
  }
}
