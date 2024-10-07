/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  HideTooltipEvent,
  OverlayDismissedEvent,
  PersistToggleEvent,
  ShowTooltipEvent,
} from "../../events/events";
import { classMap } from "lit/directives/class-map.js";

const DOCK_ZONE_SIZE = 32;
const DOCK_ZONE_CLEARANCE = 91;

interface DockStatus {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

@customElement("bb-drag-dock-overlay")
export class DragDockOverlay extends LitElement {
  @property()
  overlayTitle: string | null = null;

  @property({ reflect: true })
  overlayIcon: string | null = null;

  @property()
  maximizeKey: string | null = null;

  @property()
  persistable = false;

  @property({ reflect: true })
  persist = false;

  @property()
  dockKey: string | null = null;

  @property()
  dockable = false;

  @property()
  x: number | null = null;

  @property()
  y: number | null = null;

  @property({ reflect: true })
  static = false;

  @property()
  dock: DockStatus = {
    top: false,
    right: false,
    bottom: false,
    left: false,
  };

  @property()
  dockZones = {
    left: new DOMRect(
      0,
      DOCK_ZONE_CLEARANCE,
      DOCK_ZONE_SIZE,
      window.innerHeight - DOCK_ZONE_CLEARANCE
    ),
    right: new DOMRect(
      window.innerWidth - DOCK_ZONE_CLEARANCE,
      DOCK_ZONE_CLEARANCE,
      DOCK_ZONE_SIZE,
      window.innerHeight - DOCK_ZONE_CLEARANCE
    ),
    top: new DOMRect(0, DOCK_ZONE_CLEARANCE, window.innerWidth, DOCK_ZONE_SIZE),
    bottom: new DOMRect(
      0,
      window.innerHeight - DOCK_ZONE_SIZE,
      window.innerWidth,
      DOCK_ZONE_SIZE
    ),
  };

  @property({ reflect: true })
  showDockDropZones = false;

  @property({ reflect: true })
  maximized = false;

  @property({ reflect: true })
  highlightDropZoneLeft = false;

  @property({ reflect: true })
  highlightDropZoneRight = false;

  @property({ reflect: true })
  dockedLeft = false;

  @property({ reflect: true })
  dockedRight = false;

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onWindowPointerDownBound = this.#onWindowPointerDown.bind(this);
  #contentRef: Ref<HTMLDivElement> = createRef();
  #dock = structuredClone(this.dock);

  #bounds: DOMRect | null = null;
  #contentBounds: DOMRect | null = null;
  #left: number | null = null;
  #top: number | null = null;
  #dragging = false;
  #dragStart = { x: 0, y: 0 };
  #dragDelta = { x: 0, y: 0 };

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }

    #wrapper > h1 {
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

    #wrapper > h1 span {
      flex: 1 0 auto;
    }

    :host([overlayicon="activity"]) #wrapper > h1::before,
    :host([overlayicon="comment"]) #wrapper > h1::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-vital-signs) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    :host([overlayicon="comment"]) #wrapper > h1::before {
      background-image: var(--bb-icon-comment);
    }

    :host([overlayicon="activity"]) #wrapper > h1::before {
      background-image: var(--bb-icon-vital-signs);
    }

    #content {
      border-radius: var(--bb-grid-size-2);
      background: var(--bb-neutral-0);

      display: flex;
      flex-direction: column;

      opacity: 0;
      animation: fadeAndScaleIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
      position: fixed;

      border: 1px solid var(--bb-neutral-300);
      box-shadow:
        0 8px 8px 0 rgba(0, 0, 0, 0.07),
        0 15px 12px 0 rgba(0, 0, 0, 0.09);

      display: flex;
      flex-direction: column;
      resize: both;
      overflow: auto;

      width: 420px;
      min-width: 200px;
      max-width: 80svw;
      max-height: calc(100svh - 120px);

      left: var(--left, auto);
      top: var(--top, auto);
      right: var(--right, auto);
      bottom: var(--bottom, auto);
      pointer-events: auto;
    }

    :host([static="true"]) #content {
      opacity: 1;
      animation: none;
    }

    :host([dockedleft="true"][dockedright="true"]) #content {
      resize: neither;
      width: auto;
      max-width: calc(100svw - 32px);
    }

    :host([dockedleft="true"]) #content,
    :host([dockedright="true"]) #content {
      resize: horizontal;
    }

    #wrapper {
      flex: 1 1 auto;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    #content[dir="rtl"] #wrapper {
      direction: ltr;
    }

    .drop-zone {
      pointer-events: none;
      background: var(--bb-ui-100);
      position: fixed;
      display: block;
      opacity: 0;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    .drop-zone.top,
    .drop-zone.bottom {
      background: none;
    }

    :host([showdockdropzones="true"]) .drop-zone {
      opacity: 0.4;
    }

    :host([showdockdropzones="true"][highlightdropzoneleft="true"])
      .drop-zone.left,
    :host([showdockdropzones="true"][highlightdropzoneright="true"])
      .drop-zone.right {
      opacity: 1;
    }

    .drop-zone.left {
      top: var(--dzl-top);
      left: var(--dzl-left);
      width: var(--dzl-width);
      height: var(--dzl-height);
    }

    .drop-zone.right {
      top: var(--dzr-top);
      left: var(--dzr-left);
      width: var(--dzr-width);
      height: var(--dzr-height);
    }

    .drop-zone.top {
      top: var(--dzt-top);
      left: var(--dzt-left);
      width: var(--dzt-width);
      height: var(--dzt-height);
    }

    .drop-zone.top.active {
      left: var(--dzt-active-left);
      width: var(--dzt-active-width);
    }

    .drop-zone.bottom {
      top: var(--dzb-top);
      left: var(--dzb-left);
      width: var(--dzb-width);
      height: var(--dzb-height);
    }

    .drop-zone.bottom.active {
      left: var(--dzb-active-left);
      width: var(--dzb-active-width);
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

    #persist {
      border-radius: var(--bb-grid-size);
      padding: 0;
      height: var(--bb-grid-size-5);
      width: var(--bb-grid-size-5);
      cursor: pointer;
      border: 1px solid var(--bb-neutral-300);
      transition: all 0.3s cubic-bezier(0, 0, 0.3, 1);
      font-size: 0;
      background: var(--bb-neutral-0) var(--bb-icon-anchor) center center / 16px
        16px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #persist:focus,
    #persist:hover {
      color: var(--bb-neutral-600);
      background: var(--bb-neutral-0) var(--bb-icon-anchor-active) center center /
        16px 16px no-repeat;
      border: 1px solid var(--bb-neutral-300);
    }

    #persist.active {
      opacity: 1;
      color: var(--bb-neutral-700);
      background: var(--bb-neutral-50) var(--bb-icon-anchor-active) center
        center / 16px 16px no-repeat;
      border: 1px solid var(--bb-neutral-500);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 0.1;
      }
    }

    @keyframes fadeAndScaleIn {
      from {
        transform: scale(0.9, 0.9);
        opacity: 0;
      }

      to {
        transform: none;
        opacity: 1;
      }
    }
  `;

  #resizeObserver = new ResizeObserver((entries) => {
    if (entries.length === 0) {
      return;
    }

    const [entry] = entries;
    this.#bounds = entry.contentRect;

    this.dockZones.left.height = this.#bounds.height;

    this.dockZones.right.x = this.#bounds.width - DOCK_ZONE_SIZE;
    this.dockZones.right.height = this.#bounds.height;

    this.dockZones.top.width = this.#bounds.width;

    this.dockZones.bottom.y = this.#bounds.height - DOCK_ZONE_SIZE;
    this.dockZones.bottom.width = this.#bounds.width;

    this.#updateStyles();
  });

  connectedCallback(): void {
    super.connectedCallback();
    this.#resizeObserver.observe(this);

    window.addEventListener("pointerdown", this.#onWindowPointerDownBound);
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();

    window.removeEventListener("pointerdown", this.#onWindowPointerDownBound);
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  protected firstUpdated(changedProperties: PropertyValues): void {
    if (!this.#left || !this.#top) {
      this.#contentBounds =
        this.#contentRef.value?.getBoundingClientRect() ?? null;
      if (this.x !== null && this.y !== null) {
        this.#left = this.x;
        this.#top = this.y;
      } else {
        this.#left = this.#contentBounds?.x ?? null;
        this.#top = this.#contentBounds?.y ?? null;
      }

      this.#clampLeftAndTopValues();
    }

    if (!changedProperties.has("dock")) {
      return;
    }

    if (this.maximized) {
      return;
    }

    requestAnimationFrame(() => {
      if (this.maximizeKey) {
        const maximized =
          globalThis.localStorage.getItem(this.maximizeKey) === "true";

        if (maximized) {
          this.#setMaximized();
        } else {
          this.#setDocked();
        }
      } else {
        this.#setDocked();
      }

      if (this.dockKey) {
        const dockStatus = globalThis.localStorage.getItem(this.dockKey);

        if (dockStatus) {
          if (dockStatus === "left") {
            this.#dockLeft();
          } else if (dockStatus === "right") {
            this.#dockRight();
          }
        }
      }
    });
  }

  #onWindowPointerDown() {
    this.dispatchEvent(new OverlayDismissedEvent());
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key !== "Escape") {
      return;
    }

    this.dispatchEvent(new OverlayDismissedEvent());
  }

  get contentBounds(): DOMRect {
    if (!this.#contentRef.value) {
      return new DOMRect(0, 0, 0, 0);
    }

    const bounds = this.#contentRef.value.getBoundingClientRect();
    return bounds;
  }

  #setMaximized() {
    this.#dock.top = true;
    this.#dock.left = true;
    this.#dock.right = true;
    this.#dock.bottom = true;

    if (this.maximizeKey) {
      globalThis.localStorage.setItem(this.maximizeKey, "true");
    }

    this.#updateStyles();
  }

  #setDocked() {
    this.#dock.top = this.dock.top;
    this.#dock.right = this.dock.right;
    this.#dock.bottom = this.dock.bottom;
    this.#dock.left = this.dock.left;

    if (this.maximizeKey) {
      globalThis.localStorage.setItem(this.maximizeKey, "false");
    }

    this.#updateStyles();
  }

  #undockContent() {
    this.dock.top = this.dock.bottom = this.dock.left = this.dock.right = false;
    this.#dock = structuredClone(this.dock);

    if (this.dockKey) {
      globalThis.localStorage.removeItem(this.dockKey);
    }

    this.#updateStyles();
  }

  #dockIfIntersectingWithZones(bounds: DOMRect) {
    if (this.dockable) {
      if (this.#intersects(this.dockZones.left, bounds)) {
        this.#dockLeft(true);
      }

      if (this.#intersects(this.dockZones.right, bounds)) {
        this.#dockRight(true);
      }
    }

    this.#updateStyles();
  }

  #dockLeft(skipUpdate = false) {
    this.dock.top = this.dock.bottom = this.dock.left = true;
    this.dock.right = false;
    this.#dock = structuredClone(this.dock);

    if (this.dockKey) {
      globalThis.localStorage.setItem(this.dockKey, "left");
    }

    if (skipUpdate) {
      return;
    }

    this.#updateStyles();
  }

  #dockRight(skipUpdate = false) {
    this.dock.top = this.dock.bottom = this.dock.right = true;
    this.dock.left = false;
    this.#dock = structuredClone(this.dock);

    if (this.dockKey) {
      globalThis.localStorage.setItem(this.dockKey, "right");
    }

    if (skipUpdate) {
      return;
    }

    this.#updateStyles();
  }

  #updateStyles() {
    const left = this.dockZones.left.left + this.dockZones.left.width * 0.5;
    const right = this.dockZones.right.width * 0.5;
    const top = this.dockZones.top.top + this.dockZones.top.height * 0.5;
    const bottom = this.dockZones.bottom.height * 0.5;

    const undockedTop = `${this.#top}px`;

    if (this.#dock.left) {
      this.style.setProperty("--left", `${left}px`);
    } else {
      if (this.#dock.right) {
        this.style.setProperty("--left", `auto`);
      } else {
        this.style.setProperty("--left", `${this.#left}px`);
      }
    }

    if (this.#dock.right) {
      this.style.setProperty("--right", `${right}px`);
    } else {
      this.style.setProperty("--right", `auto`);
    }

    this.style.setProperty("--top", this.#dock.top ? `${top}px` : undockedTop);
    this.style.setProperty(
      "--bottom",
      this.#dock.bottom ? `${bottom}px` : "auto"
    );

    this.highlightDropZoneLeft =
      this.#left !== null && this.#left < this.dockZones.left.right;
    this.highlightDropZoneRight =
      this.#left !== null &&
      this.#contentBounds !== null &&
      this.#left + this.#contentBounds.width > this.dockZones.right.left;

    // Left Dock Zone.
    this.style.setProperty("--dzl-top", `${this.dockZones.left.top}px`);
    this.style.setProperty("--dzl-left", `${this.dockZones.left.left}px`);
    this.style.setProperty("--dzl-width", `${this.dockZones.left.width}px`);
    this.style.setProperty("--dzl-height", `${this.dockZones.left.height}px`);

    // Right Dock Zone.
    this.style.setProperty("--dzr-top", `${this.dockZones.right.top}px`);
    this.style.setProperty("--dzr-left", `${this.dockZones.right.left}px`);
    this.style.setProperty("--dzr-width", `${this.dockZones.right.width}px`);
    this.style.setProperty("--dzr-height", `${this.dockZones.right.height}px`);

    // Top Dock Zone.
    this.style.setProperty("--dzt-top", `${this.dockZones.top.top}px`);
    this.style.setProperty(
      "--dzt-left",
      `${this.dockZones.top.left + this.dockZones.left.width}px`
    );
    this.style.setProperty(
      "--dzt-width",
      `${this.dockZones.top.width - this.dockZones.left.width - this.dockZones.right.width}px`
    );
    this.style.setProperty("--dzt-height", `${this.dockZones.top.height}px`);

    this.style.setProperty("--dzt-active-left", `${this.dockZones.top.left}px`);
    this.style.setProperty(
      "--dzt-active-width",
      `${this.dockZones.top.width}px`
    );

    // Bottom Dock Zone.
    this.style.setProperty("--dzb-top", `${this.dockZones.bottom.top}px`);
    this.style.setProperty(
      "--dzb-left",
      `${this.dockZones.bottom.left + this.dockZones.left.width}px`
    );
    this.style.setProperty(
      "--dzb-width",
      `${this.dockZones.bottom.width - this.dockZones.left.width - this.dockZones.right.width}px`
    );
    this.style.setProperty("--dzb-height", `${this.dockZones.bottom.height}px`);

    this.style.setProperty(
      "--dzb-active-left",
      `${this.dockZones.bottom.left}px`
    );
    this.style.setProperty(
      "--dzb-active-width",
      `${this.dockZones.bottom.width}px`
    );

    if (this.#contentRef.value) {
      if (this.#dock.top && this.#dock.bottom) {
        this.#contentRef.value.style.height = "";
      }

      if (this.#dock.left && this.#dock.right) {
        this.#contentRef.value.style.width = "";
      }

      this.#contentRef.value.dir = this.#dock.right ? "rtl" : "ltr";
    }

    this.dockedLeft = this.#dock.left;
    this.dockedRight = this.#dock.right;
  }

  #intersects(r1: DOMRect, r2: DOMRect) {
    const leftInside = r2.left > r1.left && r2.left < r1.left + r1.width;
    const topInside = r2.top > r1.top && r2.top < r1.top + r1.height;
    const rightInside = r2.right > r1.left && r2.right < r1.left + r1.width;
    const bottomInside = r2.bottom > r1.top && r2.bottom < r1.top + r1.height;
    return (leftInside && topInside) || (rightInside && bottomInside);
  }

  #clampLeftAndTopValues() {
    if (!this.#contentBounds || !this.#left || !this.#top) {
      return;
    }

    const minX = this.dockZones.left.left + this.dockZones.left.width * 0.5;
    const minY = this.dockZones.top.top + this.dockZones.top.height * 0.5;

    const maxX =
      this.dockZones.right.left +
      this.dockZones.right.width * 0.5 -
      this.#contentBounds.width;

    const maxY =
      this.dockZones.bottom.top +
      this.dockZones.bottom.height * 0.5 -
      this.#contentBounds.height;

    if (this.#left < minX) {
      this.#left = minX;
    }

    if (this.#left > maxX) {
      this.#left = maxX;
    }

    if (this.#top < minY) {
      this.#top = minY;
    }

    if (this.#top > maxY) {
      this.#top = maxY;
    }
  }

  render() {
    return html`
      <div class="drop-zone left"></div>
      <div class="drop-zone right"></div>
      <div class="drop-zone top"></div>
      <div class="drop-zone bottom"></div>

      <div
        id="content"
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
        ${ref(this.#contentRef)}
      >
        <div id="wrapper">
          ${this.overlayTitle
            ? html`<h1
                @pointerdown=${(evt: PointerEvent) => {
                  if (this.maximized) {
                    return;
                  }

                  if (!(evt.target instanceof HTMLElement)) {
                    return;
                  }

                  this.#contentBounds =
                    this.#contentRef.value?.getBoundingClientRect() ?? null;
                  if (!this.#contentBounds) {
                    return;
                  }

                  this.#left = this.#contentBounds.x;
                  this.#top = this.#contentBounds.y;

                  this.#undockContent();

                  this.#contentBounds =
                    this.#contentRef.value?.getBoundingClientRect() ?? null;
                  if (!this.#contentBounds) {
                    return;
                  }

                  this.#dragStart.x = evt.clientX;
                  this.#dragStart.y = evt.clientY;
                  this.#dragging = true;

                  evt.target.setPointerCapture(evt.pointerId);
                }}
                @pointermove=${(evt: PointerEvent) => {
                  if (!this.#dragging || !this.#contentBounds) {
                    return;
                  }

                  this.#dragDelta.x = evt.clientX - this.#dragStart.x;
                  this.#dragDelta.y = evt.clientY - this.#dragStart.y;

                  this.#left = this.#contentBounds.x + this.#dragDelta.x;
                  this.#top = this.#contentBounds.y + this.#dragDelta.y;

                  this.#clampLeftAndTopValues();

                  if (this.dockable) {
                    this.showDockDropZones = true;
                  }
                  this.#updateStyles();
                }}
                @pointerup=${() => {
                  this.#contentBounds = null;
                  this.#dragging = false;
                  if (this.dockable) {
                    this.showDockDropZones = false;
                  }

                  const bounds =
                    this.#contentRef.value?.getBoundingClientRect();
                  if (!bounds) {
                    return;
                  }

                  this.#dockIfIntersectingWithZones(bounds);
                }}
              >
                <span>${this.overlayTitle}</span>
                ${this.persistable
                  ? html`<button
                      id="persist"
                      class=${classMap({ active: this.persist })}
                      @pointerover=${(evt: PointerEvent) => {
                        this.dispatchEvent(
                          new ShowTooltipEvent(
                            "Keep open",
                            evt.clientX,
                            evt.clientY
                          )
                        );
                      }}
                      @pointerout=${() => {
                        this.dispatchEvent(new HideTooltipEvent());
                      }}
                      @pointerdown=${(evt: PointerEvent) => {
                        evt.stopImmediatePropagation();
                      }}
                      @pointerup=${(evt: PointerEvent) => {
                        evt.stopImmediatePropagation();
                      }}
                      @click=${() => {
                        this.dispatchEvent(new PersistToggleEvent());
                      }}
                    >
                      Keep Open
                    </button>`
                  : nothing}

                <button
                  id="minmax"
                  class=${classMap({ maximized: this.maximized })}
                  @pointerdown=${(evt: PointerEvent) => {
                    evt.stopImmediatePropagation();
                  }}
                  @pointerup=${(evt: PointerEvent) => {
                    evt.stopImmediatePropagation();
                  }}
                  @click=${() => {
                    if (this.maximized) {
                      this.maximized = false;
                      this.#setDocked();
                    } else {
                      this.maximized = true;
                      this.#setMaximized();
                    }
                  }}
                >
                  ${this.maximized ? "Minimize" : "Maximize"}
                </button>
              </h1>`
            : nothing}
          <slot name="search"></slot>
          <slot></slot>
        </div>
      </div>
    `;
  }
}
