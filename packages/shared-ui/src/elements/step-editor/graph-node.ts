/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Editor");

import {
  html,
  css,
  PropertyValues,
  nothing,
  HTMLTemplateResult,
  svg,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { Box } from "./box";
import {
  NodeBoundsUpdateRequestEvent,
  NodeConfigurationRequestEvent,
  NodeSelectEvent,
  SelectionMoveEvent,
  SelectionTranslateEvent,
} from "./events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import {
  InspectableNodePorts,
  NodeValue,
  SchemaEnumValue,
} from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
  isPreviewBehavior,
} from "../../utils/behaviors";
import { createTruncatedValue } from "./utils/create-truncated-value";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { styles as ChicletStyles } from "../../styles/chiclet.js";
import { toGridSize } from "./utils/to-grid-size";
import { DragConnectorReceiver } from "../../types/types";
import { DragConnectorStartEvent } from "../../events/events";
import { getGlobalColor } from "../../utils/color.js";
import { createChiclets } from "./utils/create-chiclets.js";

const EDGE_STANDARD = getGlobalColor("--bb-neutral-400");

const arrowWidth = 46;
const arrowHeight = 36;
const arrowSize = 8;
const rightArrow = html`${svg`
  <svg id="right-arrow" version="1.1"
      width="${arrowWidth}" height=${arrowHeight}
      xmlns="http://www.w3.org/2000/svg">
    <line x1="0"
      y1=${arrowHeight * 0.5}
      x2=${arrowWidth}
      y2=${arrowHeight * 0.5}
      stroke=${EDGE_STANDARD} stroke-width="2" stroke-linecap="round" />

    <line x1=${arrowWidth}
      y1=${arrowHeight * 0.5}
      x2=${arrowWidth - arrowSize}
      y2=${arrowHeight * 0.5 - arrowSize}
      stroke=${EDGE_STANDARD} stroke-width="2" stroke-linecap="round" />

    <line x1=${arrowWidth} y1=${arrowHeight * 0.5}
    x2=${arrowWidth - arrowSize}
    y2=${arrowHeight * 0.5 + arrowSize}
    stroke=${EDGE_STANDARD} stroke-width="2" stroke-linecap="round" />
  </svg>`}`;

@customElement("bb-graph-node")
export class GraphNode extends Box implements DragConnectorReceiver {
  @property()
  accessor nodeTitle = "";

  @property({ reflect: true })
  accessor icon: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor updating = false;

  @property()
  accessor hasMainPort = false;

  @property({ reflect: true, type: String })
  accessor highlightType: "user" | "model" = "model";

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property({ reflect: true, type: String })
  accessor active: "pre" | "current" | "post" | "error" = "pre";

  @property()
  accessor showDefaultAdd = false;

  @property()
  set ports(ports: InspectableNodePorts | null) {
    this.#ports = ports;

    if (!ports) {
      return;
    }

    for (const port of ports.outputs.ports) {
      if (port.schema.behavior?.includes("main-port")) {
        this.hasMainPort = true;
        break;
      }
    }
  }
  get ports() {
    return this.#ports;
  }

  static styles = [
    Box.styles,
    ChicletStyles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        pointer-events: auto;
        user-select: none;
        font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        color: var(--bb-neutral-900);
        line-height: var(--bb-grid-size-6);
        z-index: 3;
        outline: none;
      }

      :host([selected]) {
        z-index: 4;
      }

      :host([active="current"]) #container::before {
        content: "";
        position: absolute;
        width: 100%;
        height: 100%;
        outline: var(--bb-grid-size-2) solid
          oklch(from var(--bb-ui-600) l c h / 0.25);
        border-radius: var(--bb-grid-size-3);
        z-index: 0;
      }

      :host([active="current"]) #container header::after {
        opacity: 1;
        background-image: url(/images/progress-ui.svg);
      }

      :host {
        --background: var(--bb-ui-100);
        --border: var(--bb-neutral-500);
        --header-border: var(--bb-ui-300);
      }

      :host([updating]) {
        --background: var(--bb-neutral-100);
        --border: var(--bb-neutral-500);
        --header-border: var(--bb-neutral-300);

        & #content {
          min-height: 120px;
        }
      }

      :host(.generative),
      :host([icon="generative"]),
      :host([icon="generative-image"]),
      :host([icon="generative-audio"]),
      :host([icon="generative-text"]),
      :host([icon="generative-image-edit"]),
      :host([icon="generative-code"]),
      :host([icon="generative-video"]),
      :host([icon="generative-search"]),
      :host([icon="laps"]) {
        --background: var(--bb-generative-100);
        --border: var(--bb-neutral-500);
        --header-border: var(--bb-generative-300);
      }

      :host(.module) {
        --background: var(--bb-module-100);
        --border: var(--bb-neutral-500);
        --header-border: var(--bb-module-300);
      }

      :host(.input),
      :host(.output),
      :host(.core),
      :host([icon="input"]),
      :host([icon="output"]),
      :host([icon="combine-outputs"]) {
        --background: var(--bb-input-50);
        --border: var(--bb-neutral-500);
        --header-border: var(--bb-input-300);
      }

      :host([icon="search"]) #container header::before {
        background: var(--bb-icon-search) center center / 20px 20px no-repeat;
      }

      :host([icon="map-search"]) #container header::before {
        background: var(--bb-icon-map-search) center center / 20px 20px
          no-repeat;
      }

      :host([icon="globe-book"]) #container header::before {
        background: var(--bb-icon-globe-book) center center / 20px 20px
          no-repeat;
      }

      :host([icon="language"]) #container header::before {
        background: var(--bb-icon-language) center center / 20px 20px no-repeat;
      }

      :host([icon="sunny"]) #container header::before {
        background: var(--bb-icon-sunny) center center / 20px 20px no-repeat;
      }

      :host([icon="generative"]) #container header::before {
        background: var(--bb-add-icon-generative) center center / 20px 20px
          no-repeat;
      }

      :host([icon="generative-image"]) #container header::before {
        background: var(--bb-add-icon-generative-image) center center / 20px
          20px no-repeat;
      }

      :host([icon="generative-image-edit"]) #container header::before {
        background: var(--bb-add-icon-generative-image-edit-auto) center
          center / 20px 20px no-repeat;
      }

      :host([icon="generative-text"]) #container header::before {
        background: var(--bb-add-icon-generative-text-analysis) center center /
          20px 20px no-repeat;
      }

      :host([icon="generative-audio"]) #container header::before {
        background: var(--bb-add-icon-generative-audio) center center / 20px
          20px no-repeat;
      }

      :host([icon="generative-video"]) #container header::before {
        background: var(--bb-add-icon-generative-videocam-auto) center center /
          20px 20px no-repeat;
      }

      :host([icon="generative-code"]) #container header::before {
        background: var(--bb-add-icon-generative-code) center center / 20px 20px
          no-repeat;
      }

      :host([icon="generative-search"]) #container header::before {
        background: var(--bb-add-icon-generative-search) center center / 20px
          20px no-repeat;
      }

      :host([icon="combine-outputs"]) #container header::before {
        background: var(--bb-icon-table-rows) center center / 20px 20px
          no-repeat;
      }

      :host([icon="input"]) #container header::before {
        background: var(--bb-icon-input) center center / 20px 20px no-repeat;
      }

      :host([icon="output"]) #container header::before {
        background: var(--bb-icon-output) center center / 20px 20px no-repeat;
      }

      :host([icon="smart-toy"]) #container header::before {
        background: var(--bb-icon-smart-toy) center center / 20px 20px no-repeat;
      }

      :host([icon="laps"]) #container header::before {
        background: var(--bb-icon-laps) center center / 20px 20px no-repeat;
      }

      :host(:not([updating]):not([icon])) #container header::before {
        display: none;
      }

      :host([selected]) #container {
        outline: 2px solid var(--bb-ui-500);
      }

      :host(:not([updating])[highlighted][highlighttype="model"]) #container {
        outline: 7px solid oklch(from var(--bb-generative-700) l c h / 0.6);
      }

      :host(:not([updating])[highlighted][highlighttype="user"]) #container {
        outline: 7px solid oklch(from var(--bb-ui-600) l c h / 0.6);
      }

      :host([moving]) #container header {
        cursor: grabbing;
      }

      #container {
        width: 260px;
        border-radius: var(--bb-grid-size-3);
        outline: 1px solid var(--border);
        color: var(--bb-neutral-900);
        position: relative;
        cursor: pointer;

        #right-arrow {
          position: absolute;
          top: 0px;
          left: 100%;
          width: 46px;
          height: 36px;
        }

        #default-add {
          position: absolute;
          top: 18px;
          left: 100%;
          transform: translateX(48px) translateY(-50%);
          z-index: 4;
          border: 1px solid var(--bb-neutral-300);
          color: var(--bb-neutral-600);
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          border-radius: var(--bb-grid-size-16);
          background: var(--bb-neutral-50) var(--bb-icon-library-add) 8px
            center / 20px 20px no-repeat;
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
          transition: border 0.2s cubic-bezier(0, 0, 0.3, 1);
          height: var(--bb-grid-size-7);
          cursor: pointer;
          white-space: nowrap;
          pointer-events: auto;

          &:hover {
            border: 1px solid var(--bb-neutral-500);
          }
        }

        & header {
          display: flex;
          align-items: center;
          background: var(--background);
          height: var(--bb-grid-size-9);
          width: 100%;
          padding: 0 var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size-3) var(--bb-grid-size-3) 0 0;
          font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
            var(--bb-font-family);
          position: relative;
          justify-content: center;

          & span {
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          }

          &::before {
            flex: 0 0 auto;
            content: "";
            width: 20px;
            height: 20px;
            background: url(/images/progress.svg) center center / 20px 20px
              no-repeat;
            margin-right: var(--bb-grid-size-2);
          }

          & > * {
            pointer-events: none;
          }

          & #connection-trigger {
            position: absolute;
            display: block;
            pointer-events: auto;
            width: 10px;
            height: 10px;
            border: none;
            border-radius: 50%;
            background: var(--border);
            right: -5px;
            top: 18px;
            translate: 0 -50%;
            font-size: 0;
            padding: 0;

            &:not([disabled]) {
              cursor: pointer;
            }
          }
        }

        & #content {
          position: relative;
          background: var(--bb-neutral-0);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
          line-height: var(--bb-grid-size-6);
          border-radius: 0 0 var(--bb-grid-size-3) var(--bb-grid-size-3);
          pointer-events: none;

          p {
            margin: 0 0 var(--bb-grid-size-2) 0;

            &:last-of-type {
              margin-bottom: 0;
            }
          }

          #ports {
            display: flex;
            flex-direction: column;

            > * {
              line-height: var(--bb-grid-size-6);
              margin-bottom: var(--bb-grid-size-2);
              display: flex;
              align-items: center;
            }

            & .port {
              transition:
                background-color 0.2s cubic-bezier(0, 0, 0.3, 1),
                outline 0.2s cubic-bezier(0, 0, 0.3, 1);
              border-radius: var(--bb-grid-size);
              outline: 4px solid transparent;
              text-align: center;

              &.object {
                white-space: pre-line;
                margin-bottom: var(--bb-grid-size-3);
                overflow: hidden;

                /** 7 lines of text **/
                max-height: 168px;
                align-items: flex-start;

                p {
                  /** Create space for chiclet borders */
                  padding: 1px;
                  width: 100%;
                }

                & .missing {
                  width: 100%;
                  white-space: normal;
                  color: var(--bb-boards-600);

                  & span {
                    display: inline-flex;
                    align-items: center;
                    margin-top: var(--bb-grid-size);
                    background: var(--bb-neutral-200) var(--bb-icon-add) 8px
                      center / 20px 20px no-repeat;
                    height: var(--bb-grid-size-7);
                    padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
                    border-radius: var(--bb-grid-size-16);
                    color: var(--bb-neutral-700);
                  }
                }
              }

              &.boolean {
                &::before {
                  content: "";
                  display: block;
                  width: 20px;
                  height: 20px;
                  background: var(--bb-neutral-0);
                  margin-right: var(--bb-grid-size-2);
                  border-radius: var(--bb-grid-size);
                  border: 1px solid var(--bb-neutral-300);
                  box-sizing: border-box;
                }

                &.checked::before {
                  background: var(--bb-neutral-0) var(--bb-icon-check) center
                    center / 20px 20px no-repeat;
                }
              }

              &.string {
                &.voice-selection::before,
                &.frame-source::before,
                &.multimodal::before,
                &.audio::before,
                &.image::before,
                &.video::before,
                &.joiner::before {
                  content: "";
                  display: block;
                  width: 20px;
                  height: 20px;
                  margin-right: var(--bb-grid-size-2);
                  box-sizing: border-box;
                }

                &.voice-selection::before {
                  background: var(--bb-icon-voice-selection) center center /
                    20px 20px no-repeat;
                }

                &.frame-source::before {
                  background: var(--bb-icon-frame-source) center center / 20px
                    20px no-repeat;
                }

                &.multimodal::before {
                  background: var(--bb-icon-multimodal) center center / 20px
                    20px no-repeat;
                }

                &.audio::before {
                  background: var(--bb-icon-mic) center center / 20px 20px
                    no-repeat;
                }

                &.image::before {
                  background: var(--bb-icon-image) center center / 20px 20px
                    no-repeat;
                }

                &.video::before {
                  background: var(--bb-icon-add-video) center center / 20px 20px
                    no-repeat;
                }

                &.joiner::before {
                  background: var(--bb-icon-merge-type) center center / 20px
                    20px no-repeat;
                }
              }
            }
          }
        }

        & #chiclets {
          text-align: center;

          & > * {
            margin: 0 2px;
          }
        }
      }
    `,
  ];

  #translateStart: DOMPoint | null = null;
  #dragStart: DOMPoint | null = null;
  #containerRef: Ref<HTMLElement> = createRef();
  #lastBounds: DOMRect | null = null;
  #ports: InspectableNodePorts | null = null;
  #resizeObserver = new ResizeObserver(() => {
    if (!this.#containerRef.value || this.hidden) {
      return;
    }

    this.#lastBounds = new DOMRect(
      0,
      0,
      this.#containerRef.value.offsetWidth,
      this.#containerRef.value.offsetHeight
    );

    this.dispatchEvent(new NodeBoundsUpdateRequestEvent());
  });

  constructor(public readonly nodeId: string) {
    super();

    this.tabIndex = 0;
  }

  calculateLocalBounds(): DOMRect {
    if (!this.#containerRef.value || !this.#lastBounds) {
      return new DOMRect();
    }

    return this.#lastBounds;
  }

  #watchingResize = false;
  protected updated(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("nodeTitle") ||
      changedProperties.has("updating")
    ) {
      requestAnimationFrame(() => {
        this.cullable = true;
        this.dispatchEvent(new NodeBoundsUpdateRequestEvent());
      });
    }

    if (!this.#watchingResize && this.#containerRef.value) {
      this.#watchingResize = true;
      this.#lastBounds = new DOMRect(
        0,
        0,
        this.#containerRef.value.offsetWidth,
        this.#containerRef.value.offsetHeight
      );

      this.#resizeObserver.observe(this.#containerRef.value);
    }
  }

  adjustTranslation(x: number, y: number) {
    super.adjustTranslation(x, y);

    // If the translation is adjusted from the outside by the graph we update
    // the translation start so that our drag behaviors are orientated from the
    // correct location.
    if (this.#translateStart) {
      this.#translateStart.x += x;
      this.#translateStart.y += y;
    }
  }

  isOnDragConnectorTarget(): boolean {
    return true;
  }

  highlight(): void {
    this.highlighted = true;
  }

  removeHighlight(): void {
    this.highlighted = false;
  }

  #renderPorts() {
    if (!this.#ports) {
      return nothing;
    }

    const previewPorts = this.#ports.inputs.ports.filter(
      (port) =>
        isPreviewBehavior(port.schema) &&
        (isLLMContentBehavior(port.schema) ||
          isLLMContentArrayBehavior(port.schema))
    );

    const portsArePopulated = previewPorts.some(
      (port) => port.value !== undefined
    );

    const chiclets: HTMLTemplateResult[] = [];

    return html`<div id="ports">
        ${previewPorts.length > 0
          ? portsArePopulated
            ? map(previewPorts, (port) => {
                const classes: Record<string, boolean> = { port: true };
                let value: HTMLTemplateResult | symbol = html`No value`;
                switch (port.schema.type) {
                  case "object": {
                    classes.object = true;
                    if (port.value) {
                      value = html`${unsafeHTML(
                        `<p>${createTruncatedValue(port)}</p>`
                      )}`;

                      chiclets.push(...createChiclets(port));
                    } else {
                      value = html`<p>Value not set</p>`;
                    }
                    break;
                  }

                  case "boolean": {
                    const checked = !!port.value;
                    classes.boolean = true;
                    classes.checked = checked;
                    if (port.schema.icon) {
                      classes[port.schema.icon] = true;
                    }

                    value = html`<label>${port.title}</label>`;
                    break;
                  }

                  case "string": {
                    classes.string = true;
                    const { icon, enum: e } = port.schema;
                    if (icon) {
                      classes[icon] = true;
                    }
                    const enumValue = enumTitle(port.value, e);

                    value = html`<label
                      >${port.title}: ${enumValue ?? "Value not set"}</label
                    >`;
                    break;
                  }

                  default: {
                    value = nothing;
                  }
                }

                return html`<div class=${classMap(classes)}>${value}</div>`;
              })
            : html`<div class="port object">
                <div class="missing">
                  <p>(Empty step)</p>
                </div>
              </div>`
          : html`<div class=${classMap({ port: true })}>Tap to configure</div>`}
      </div>
      <div id="chiclets">${chiclets}</div>`;
  }

  protected renderSelf() {
    const styles: Record<string, string> = {
      transform: toCSSMatrix(this.worldTransform),
    };

    let defaultAdd: HTMLTemplateResult | symbol = nothing;
    if (this.showDefaultAdd) {
      defaultAdd = html` ${rightArrow}
        <button
          id="default-add"
          @click=${async (evt: PointerEvent) => {
            evt.stopImmediatePropagation();

            if (!this.worldBounds || !(evt.target instanceof HTMLElement)) {
              return;
            }

            this.showDefaultAdd = false;

            const target = evt.target.getBoundingClientRect();
            this.dispatchEvent(
              new NodeSelectEvent(target.x + 16, target.y, this.nodeId)
            );
          }}
        >
          ${Strings.from("LABEL_ADD_ITEM")}
        </button>`;
    }

    return html`<section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
        ${ref(this.#containerRef)}
        @dblclick=${() => {
          this.dispatchEvent(
            new NodeConfigurationRequestEvent(this.nodeId, this.worldBounds)
          );
        }}
      >
        <header
          @click=${(evt: Event) => {
            evt.stopImmediatePropagation();
          }}
          @pointerdown=${(evt: PointerEvent) => {
            if (!(evt.target instanceof HTMLElement)) {
              return;
            }

            evt.target.setPointerCapture(evt.pointerId);
            this.#dragStart = new DOMPoint();
            this.#dragStart.x = evt.clientX;
            this.#dragStart.y = evt.clientY;

            this.#translateStart = new DOMPoint(
              this.transform.e,
              this.transform.f
            );
          }}
          @pointermove=${(evt: PointerEvent) => {
            if (!this.#translateStart || !this.#dragStart) {
              return;
            }

            if (!(evt.target instanceof HTMLElement)) {
              return;
            }

            const dragPosition = new DOMPoint(evt.clientX, evt.clientY);
            const deltaX =
              (dragPosition.x - this.#dragStart.x) / this.worldTransform.a;
            const deltaY =
              (dragPosition.y - this.#dragStart.y) / this.worldTransform.a;

            const xTranslation = toGridSize(deltaX);
            const yTranslation = toGridSize(deltaY);

            if (evt.shiftKey) {
              this.dispatchEvent(
                new SelectionMoveEvent(
                  evt.clientX,
                  evt.clientY,
                  xTranslation,
                  yTranslation,
                  /* hasSettled */ false
                )
              );
              return;
            }

            this.dispatchEvent(
              new SelectionTranslateEvent(
                xTranslation,
                yTranslation,
                /* hasSettled */ false
              )
            );
          }}
          @pointerup=${(evt: PointerEvent) => {
            if (!this.#translateStart || !this.#dragStart) {
              return;
            }

            if (!(evt.target instanceof HTMLElement)) {
              return;
            }

            evt.target.releasePointerCapture(evt.pointerId);

            const dragPosition = new DOMPoint(evt.clientX, evt.clientY);
            const deltaX =
              (dragPosition.x - this.#dragStart.x) / this.worldTransform.a;
            const deltaY =
              (dragPosition.y - this.#dragStart.y) / this.worldTransform.a;

            const xTranslation = toGridSize(deltaX);
            const yTranslation = toGridSize(deltaY);

            this.#dragStart = null;
            this.#translateStart = null;

            if (evt.shiftKey) {
              this.dispatchEvent(
                new SelectionMoveEvent(
                  evt.clientX,
                  evt.clientY,
                  xTranslation,
                  yTranslation,
                  /* hasSettled */ true
                )
              );
              return;
            }

            this.dispatchEvent(
              new SelectionTranslateEvent(
                xTranslation,
                yTranslation,
                /* hasSettled */ true
              )
            );
          }}
        >
          <span>${this.nodeTitle}</span>
          ${this.hasMainPort
            ? html` ${defaultAdd}
                <button
                  id="connection-trigger"
                  ?disabled=${this.updating}
                  @pointerdown=${(evt: PointerEvent) => {
                    evt.stopImmediatePropagation();

                    this.showDefaultAdd = false;

                    // This event is picked up by the graph itself to ensure that it
                    // is tagged with the graph's ID (and thereby preventing edges
                    // across graphs).
                    this.dispatchEvent(
                      new DragConnectorStartEvent(
                        "node",
                        new DOMPoint(evt.clientX, evt.clientY)
                      )
                    );
                  }}
                >
                  Connect to..
                </button>`
            : nothing}
        </header>
        <div
          id="content"
          @pointerdown=${(evt: Event) => {
            evt.stopImmediatePropagation();
          }}
        >
          ${this.updating
            ? html`<p class="loading">Loading step details...</p>`
            : this.#renderPorts()}
        </div>
      </section>

      ${this.renderBounds()}`;
  }

  render() {
    return [
      this.renderSelf(),
      html`${repeat(this.entities.values(), (entity) => {
        entity.showBounds = this.showBounds;
        return html`${entity}`;
      })}`,
    ];
  }
}

function enumTitle(v: NodeValue, e: SchemaEnumValue[] | undefined): string {
  const s = v as string;
  const entry = e?.find((item) => typeof item !== "string" && item.id === s);
  if (!entry) return s;
  return (entry as { title: string }).title;
}
