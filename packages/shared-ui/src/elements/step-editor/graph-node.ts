/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
  AutoFocusEditorRequest,
  NodeBoundsUpdateRequestEvent,
  SelectionMoveEvent,
  SelectionTranslateEvent,
} from "./events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import {
  BehaviorSchema,
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
import { createChiclets } from "./utils/create-chiclets.js";
import { icons } from "../../styles/icons.js";
import {
  colorsLight,
  palette,
  custom,
} from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";

const EDGE_STANDARD = palette.neutral.n80;
const EDGE_SELECTED = custom.c100;
const arrowSize = 4;

@customElement("bb-graph-node")
export class GraphNode extends Box implements DragConnectorReceiver {
  @property()
  accessor ownerGraph = "";

  @property()
  accessor nodeTitle = "";

  @property()
  accessor nodeDescription = "";

  @property()
  accessor isStart = false;

  @property({ reflect: true })
  accessor icon: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor updating = false;

  @property()
  accessor hasMainPort = false;

  @property({ reflect: true, type: Boolean })
  accessor hasChatAdornment = false;

  @property({ reflect: true, type: Boolean })
  accessor hasForEachAdornment = false;

  @property({ reflect: true, type: String })
  accessor highlightType: "user" | "model" = "model";

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property({ reflect: true, type: String })
  accessor active: "pre" | "current" | "post" | "error" = "pre";

  @property()
  accessor behavior: BehaviorSchema[] = [];

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
    type,
    colorsLight,
    icons,
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
          oklch(from var(--p-30) l c h / calc(alpha * 0.25));
        border-radius: var(--bb-grid-size-3);
        z-index: 0;
      }

      :host([active="current"]) #container header::after {
        opacity: 1;
        background-image: url(/images/progress-ui.svg);
      }

      :host {
        --background: var(--n-70);
      }

      :host([updating]) {
        --background: var(--n-90);

        & #content {
          min-height: 120px;
        }
      }

      :host(.generative),
      :host([icon="spark"]),
      :host([icon="photo_spark"]),
      :host([icon="audio_magic_eraser"]),
      :host([icon="text_analysis"]),
      :host([icon="generative-image-edit"]),
      :host([icon="generative-code"]),
      :host([icon="videocam_auto"]),
      :host([icon="generative-search"]),
      :host([icon="generative"]),
      :host([icon="laps"]) {
        --background: var(--ui-generate);
      }

      :host(.module) {
        --background: var(--ui-generate);
      }

      :host(.input),
      :host(.output),
      :host(.core),
      :host([icon="input"]),
      :host([icon="ask-user"]),
      :host([icon="chat_mirror"]) {
        --background: var(--ui-get-input);
      }

      :host([icon="output"]),
      :host([icon="docs"]),
      :host([icon="drive_presentation"]),
      :host([icon="sheets"]),
      :host([icon="code"]),
      :host([icon="web"]),
      :host([icon="responsive_layout"]) {
        --background: var(--ui-display);
      }

      :host(:not([updating]):not([icon])) #container header::before {
        display: none;
      }

      :host([selected]) #container #outline,
      :host([selected]) #container #chat-adornment {
        transition: outline 0.15s cubic-bezier(0, 0, 0.3, 1);
        outline: 3px solid var(--n-0);
      }

      :host(:not([updating])[highlighted][highlighttype="model"])
        #container
        #outline {
        outline: 7px solid oklch(from var(--bb-generative-700) l c h / 0.6);
      }

      :host(:not([updating])[highlighted][highlighttype="user"])
        #container
        #outline {
        outline: 7px solid oklch(from var(--bb-ui-600) l c h / 0.6);
      }

      :host([moving]) #container header {
        cursor: grabbing;
      }

      #container {
        width: 300px;
        border-radius: calc(var(--bb-grid-size-3) + 1px);
        color: var(--bb-neutral-900);
        position: relative;
        cursor: pointer;
        border: 1px solid var(--n-90);

        #edge {
          position: absolute;
          top: 100%;
          pointer-events: none;
        }

        #adornment-surround {
          position: absolute;
          top: calc(-1 * var(--bb-grid-size-4));
          left: calc(-1 * var(--bb-grid-size-4));
          pointer-events: none;
        }

        & #fe-1 {
          position: absolute;
          top: calc(var(--bb-grid-size-6) + 2px);
          left: calc(-1 * var(--bb-grid-size-3) + 1px);
          z-index: 0;
          height: calc(100% - var(--bb-grid-size-6) - var(--bb-grid-size-6));
        }

        & #fe-2 {
          position: absolute;
          top: calc(var(--bb-grid-size-12) + 2px);
          left: calc(-1 * var(--bb-grid-size-6) + 2px);
          z-index: 0;
          height: calc(100% - var(--bb-grid-size-12) - var(--bb-grid-size-12));
        }

        & .for-each-adornment {
          pointer-events: none;
          width: 7px;
          border-radius: calc(var(--bb-grid-size-3) + 1px) 0 0
            calc(var(--bb-grid-size-3) + 1px);
          outline: 2px solid transparent;
          color: var(--bb-neutral-900);
          position: absolute;
          cursor: pointer;
          background: var(--n-90);

          & header {
            background: color-mix(in lab, var(--background), white 50%);
            height: var(--bb-grid-size-12);
            width: 100%;
            padding: 0 var(--bb-grid-size-4);
            border-radius: var(--bb-grid-size-3) var(--bb-grid-size-3) 0 0;
          }
        }

        & #outline {
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: none;
          width: 100%;
          height: 100%;
          border-radius: var(--bb-grid-size-3);
          outline: 2px solid transparent;
          z-index: 2;
        }

        & #chat-adornment {
          position: absolute;
          top: calc(100% + var(--bb-grid-size-10));
          width: 100%;
          border-radius: var(--bb-grid-size-3);
          color: var(--bb-neutral-900);
          cursor: pointer;

          header {
            --background: var(--ui-get-input);

            &::before {
              display: none;
            }

            .g-icon {
              margin-right: var(--bb-grid-size-2);
            }
          }

          #content {
            text-align: left;
            pointer-events: none;
          }
        }

        & header {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          background: var(--background);
          height: var(--bb-grid-size-12);
          width: 100%;
          padding: 0 var(--bb-grid-size-4);
          border-radius: var(--bb-grid-size-3) var(--bb-grid-size-3) 0 0;
          font-size: 16px;
          line-height: 24px;
          position: relative;
          z-index: 3;

          & span {
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          }

          & .g-icon {
            flex: 0 0 auto;
            width: 20px;
            height: 20px;
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
            background: var(--n-100);
            right: -5px;
            top: 23px;
            translate: 0 -50%;
            font-size: 0;
            padding: 0;
            outline: 2px solid var(--n-0);

            &::after {
              content: "";
              position: absolute;
              display: block;
              width: 4px;
              height: 4px;
              border-radius: 50%;
              background: var(--n-0);
              left: 3px;
              top: 3px;
            }

            &:not([disabled]) {
              cursor: pointer;

              &::before {
                content: "";
                width: 20px;
                height: 20px;
                position: absolute;
                top: -5px;
                left: -5px;
                border-radius: 50%;
                background: transparent;
              }
            }
          }
        }

        & #content {
          position: relative;
          background: var(--bb-neutral-0);
          padding: var(--bb-grid-size-3) var(--bb-grid-size-4)
            var(--bb-grid-size-4) var(--bb-grid-size-4);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
          line-height: var(--bb-grid-size-6);
          border-radius: 0 0 var(--bb-grid-size-3) var(--bb-grid-size-3);
          pointer-events: none;
          z-index: 3;

          p {
            margin: 0 0 var(--bb-grid-size-2) 0;

            &:last-of-type {
              margin-bottom: 0;
            }
          }

          #ports {
            display: flex;
            flex-direction: column;
            align-items: flex-start;

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

                &:last-of-type {
                  margin-bottom: 0;
                }

                /** 7 lines of text **/
                max-height: 168px;
                align-items: flex-start;

                p {
                  /** Create space for chiclet borders */
                  padding: 1px;
                  width: 100%;
                  white-space: normal;
                }

                & .missing {
                  width: 100%;
                  white-space: normal;
                  color: var(--n-50);

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
          text-align: left;

          & > * {
            margin: 0 2px;
          }

          & .used-in-step {
            margin: var(--bb-grid-size-3) 0;
            color: var(--n-0);
          }

          & .chiclet {
            max-width: 100%;
          }
        }
      }
    `,
  ];

  #translateStart: DOMPoint | null = null;
  #dragStart: DOMPoint | null = null;
  #containerRef: Ref<HTMLElement> = createRef();
  #adornmentRef: Ref<HTMLElement> = createRef();
  #lastBounds: DOMRect | null = null;
  #ports: InspectableNodePorts | null = null;
  #resizeObserver = new ResizeObserver(() => {
    this.#getSize();
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

  #getSize() {
    if (!this.#containerRef.value || this.hidden) {
      return;
    }

    if (!this.#adornmentRef.value) {
      this.#lastBounds = new DOMRect(
        0,
        0,
        this.#containerRef.value.offsetWidth,
        this.#containerRef.value.offsetHeight
      );
    } else {
      this.#lastBounds = new DOMRect(
        0,
        0,
        this.#containerRef.value.offsetWidth,
        this.#containerRef.value.offsetHeight +
          this.#adornmentRef.value.offsetHeight +
          40
      );
    }
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

    if (changedProperties.has("hasChatAdornment")) {
      this.#getSize();
    }

    if (!this.#watchingResize) {
      this.#watchingResize = true;
      this.#getSize();

      if (this.#containerRef.value) {
        this.#resizeObserver.observe(this.#containerRef.value);
      }
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
                      if (this.nodeDescription) {
                        value = html`<p>${this.nodeDescription}</p>`;
                      } else {
                        value = html`${unsafeHTML(
                          `<p>${createTruncatedValue(port)}</p>`
                        )}`;
                      }

                      chiclets.push(
                        ...createChiclets(
                          port,
                          this.projectState,
                          this.ownerGraph !== MAIN_BOARD_ID
                            ? this.ownerGraph
                            : ""
                        )
                      );

                      if (chiclets.length > 0) {
                        chiclets.unshift(
                          html`<h2
                            class="used-in-step md-body-small w-500 sans-flex round"
                          >
                            Used in this step
                          </h2>`
                        );
                      }
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
                <div class="missing md-body-small">
                  <p>Select to edit in editor</p>
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

    let chatAdornment: HTMLTemplateResult[] | symbol = nothing;
    if (this.hasChatAdornment) {
      chatAdornment = [
        html`${svg`
        <svg id="edge" version="1.1"
          width="300" height="40" viewBox="0 0 300 40"
          xmlns="http://www.w3.org/2000/svg">
          <path d="M 150 4 L 150 4 L 150 36"
            stroke=${this.selected ? EDGE_SELECTED : EDGE_STANDARD}
            stroke-width="2" fill="none" stroke-linecap="round" />

          <line x1="150"
            y1="4"
            x2=${150 - arrowSize}
            y2=${4 + arrowSize}
            stroke=${this.selected ? EDGE_SELECTED : EDGE_STANDARD} stroke-width="2" stroke-linecap="round" />

          <line x1="150"
            y1="4"
            x2=${150 + arrowSize}
            y2=${4 + arrowSize}
            stroke=${this.selected ? EDGE_SELECTED : EDGE_STANDARD} stroke-width="2" stroke-linecap="round" />

          <line x1="150"
            y1="36"
            x2=${150 - arrowSize}
            y2=${36 - arrowSize}
            stroke=${this.selected ? EDGE_SELECTED : EDGE_STANDARD} stroke-width="2" stroke-linecap="round" />

          <line x1="150"
            y1="36"
            x2=${150 + arrowSize}
            y2=${36 - arrowSize}
            stroke=${this.selected ? EDGE_SELECTED : EDGE_STANDARD} stroke-width="2" stroke-linecap="round" />
        </svg>`}`,
        html`<div id="chat-adornment" ${ref(this.#adornmentRef)}>
          <header class="sans-flex round w-500">
            <span class="g-icon filled">chat_mirror</span>User input
          </header>
          <div id="content">(${this.nodeTitle} chats with the user)</div>
        </div>`,
      ];
    }

    let forEachAdornment: HTMLTemplateResult | symbol = nothing;
    if (this.hasForEachAdornment) {
      forEachAdornment = html`<div id="fe-1" class="for-each-adornment"></div>
        <div id="fe-2" class="for-each-adornment"></div>`;
    }

    const renderableIcon = this.icon;

    return html` <section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
        ${ref(this.#containerRef)}
        @dblclick=${() => {
          this.dispatchEvent(new AutoFocusEditorRequest());
        }}
      >
        ${forEachAdornment}
        <div id="outline"></div>
        <header
          class="sans-flex w-500 round"
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
          ${renderableIcon
            ? html`<span class="g-icon filled round">${renderableIcon}</span>`
            : nothing}
          <span>${this.nodeTitle}</span>
          ${this.hasMainPort
            ? html` <button
                id="connection-trigger"
                ?disabled=${this.updating}
                @pointerdown=${(evt: PointerEvent) => {
                  evt.stopImmediatePropagation();

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
        ${chatAdornment}
        ${this.updating || !this.hasChatAdornment
          ? nothing
          : html`${svg`
              <svg id="adornment-surround" version="1.1"
                width=${this.bounds.width + 32} height=${this.bounds.height + 32} viewBox="0 0 ${this.bounds.width + 32} ${this.bounds.height + 32}"
                xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width=${this.bounds.width + 30} height=${this.bounds.height + 30} rx="24"
                  stroke=${this.selected ? EDGE_SELECTED : EDGE_STANDARD}
                  stroke-width="2" fill="none" stroke-dasharray="4 4" />
              </svg>
            `}`}
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
