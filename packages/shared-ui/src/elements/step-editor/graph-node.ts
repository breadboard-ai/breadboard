/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, PropertyValues, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { Box } from "./box";
import {
  NodeBoundsUpdateRequestEvent,
  SelectionTranslateEvent,
} from "./events/events";
import { GRID_SIZE } from "./constants";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InspectableNodePorts } from "@google-labs/breadboard";
import { isContextOnly } from "./utils/is-context-only";
import { map } from "lit/directives/map.js";
import { isPreviewBehavior } from "../../utils/behaviors";
import { createTruncatedValue } from "./utils/create-truncated-value";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { styles as ChicletStyles } from "../shared-styles/chiclet.js";

@customElement("bb-graph-node")
export class GraphNode extends Box {
  @property()
  accessor nodeTitle = "";

  @property({ reflect: true })
  accessor icon: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor updating = false;

  @property()
  set ports(ports: InspectableNodePorts | null) {
    this.#ports = ports;
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
        z-index: 1;
      }

      :host {
        --background: var(--bb-ui-100);
        --border: var(--bb-ui-600);
        --header-border: var(--bb-ui-300);
      }

      :host([updating]) {
        --background: var(--bb-neutral-100);
        --border: var(--bb-neutral-600);
        --header-border: var(--bb-neutral-300);
      }

      :host(.generative) {
        --background: var(--bb-generative-100);
        --border: var(--bb-generative-600);
        --header-border: var(--bb-generative-300);
      }

      :host(.module) {
        --background: var(--bb-module-100);
        --border: var(--bb-module-600);
        --header-border: var(--bb-module-300);
      }

      :host(.input),
      :host(.output),
      :host(.core) {
        --background: var(--bb-input-50);
        --border: var(--bb-input-600);
        --header-border: var(--bb-input-300);
      }

      :host([icon="generative"]) #container header::before {
        background: var(--bb-add-icon-generative) center center / 20px 20px
          no-repeat;
      }

      :host([icon="generative-image"]) #container header::before {
        background: var(--bb-add-icon-generative-image) center center / 20px
          20px no-repeat;
      }

      :host([icon="generative-text"]) #container header::before {
        background: var(--bb-add-icon-generative-text) center center / 20px 20px
          no-repeat;
      }

      :host([icon="generative-audio"]) #container header::before {
        background: var(--bb-add-icon-generative-audio) center center / 20px
          20px no-repeat;
      }

      :host([icon="combine-outputs"]) #container header::before {
        background: var(--bb-icon-table-rows) center center / 20px 20px
          no-repeat;
      }

      :host([icon="input"]) #container header::before {
        background: var(--bb-icon-input) center center / 20px 20px no-repeat;
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

      :host(:focus),
      :host([selected]) #container {
        outline: 2px solid var(--border);
        z-index: 2;
      }

      :host([moving]) #container header {
        cursor: grabbing;
      }

      #container {
        width: 260px;
        border-radius: var(--bb-grid-size-2);
        outline: 1px solid var(--border);
        color: var(--bb-neutral-900);

        & header {
          display: flex;
          align-items: center;
          background: var(--background);
          height: var(--bb-grid-size-9);
          width: 100%;
          padding: 0 var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
          border-bottom: 1px solid var(--header-border);
          font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
            var(--bb-font-family);
          cursor: pointer;

          &::before {
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
        }

        & #content {
          background: var(--bb-neutral-0);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
          line-height: var(--bb-grid-size-6);

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

            & .object {
              white-space: pre-line;
              margin-bottom: var(--bb-grid-size-4);
              overflow: hidden;

              /** 7 lines of text **/
              max-height: 168px;
              align-items: flex-start;

              p {
                /** Create space for chiclet borders */
                padding: 1px;
              }

              & .chiclet {
                cursor: default;
              }
            }

            & .boolean {
              &::before {
                content: "";
                display: block;
                width: 20px;
                height: 20px;
                margin-right: var(--bb-grid-size-2);
                border-radius: var(--bb-grid-size);
                border: 1px solid var(--bb-neutral-300);
                box-sizing: border-box;
              }

              &.checked::before {
                background: var(--bb-icon-check) center center / 20px 20px
                  no-repeat;
              }
            }

            & .string {
              &::before {
                content: "";
                display: block;
                width: 20px;
                height: 20px;
                margin-right: var(--bb-grid-size-2);
                box-sizing: border-box;
              }

              &.multimodal::before {
                background: var(--bb-icon-multimodal) center center / 20px 20px
                  no-repeat;
              }

              &.joiner::before {
                background: var(--bb-icon-merge-type) center center / 20px 20px
                  no-repeat;
              }
            }
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

  constructor(public readonly nodeId: string) {
    super();

    this.tabIndex = 0;
  }

  #toGridSize(value: number) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  calculateLocalBounds(): DOMRect {
    if (!this.#containerRef.value) {
      return new DOMRect();
    }

    if (this.hidden && this.#lastBounds) {
      return this.#lastBounds;
    }

    this.#lastBounds = new DOMRect(
      0,
      0,
      this.#containerRef.value.offsetWidth,
      this.#containerRef.value.offsetHeight
    );

    return this.#lastBounds;
  }

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

  #renderPorts() {
    if (!this.#ports) {
      return nothing;
    }

    if (!isContextOnly(this.#ports.inputs, this.#ports.outputs)) {
      return html`Unknown port type`;
    }

    const previewPorts = this.#ports.inputs.ports.filter((port) =>
      isPreviewBehavior(port.schema)
    );

    return html`<div id="ports">
      ${previewPorts.length > 0
        ? map(previewPorts, (port) => {
            const classes: Record<string, boolean> = {};
            let value: HTMLTemplateResult | symbol = html`No value`;
            switch (port.schema.type) {
              case "object": {
                classes.object = true;
                value = html`${unsafeHTML(
                  `<p>${createTruncatedValue(port)}</p>`
                )}`;
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
                if (port.schema.icon) {
                  classes[port.schema.icon] = true;
                }

                value = html`<label>${port.title}: ${port.value}</label>`;
                break;
              }

              default: {
                console.log(port);
                value = nothing;
              }
            }

            return html`<div class=${classMap(classes)}>${value}</div>`;
          })
        : html`Tap to configure`}
    </div>`;
  }

  protected renderSelf() {
    const styles: Record<string, string> = {
      transform: toCSSMatrix(this.worldTransform),
    };

    return html`<section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
        ${ref(this.#containerRef)}
      >
        <header
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

            const xTranslation = this.#toGridSize(deltaX);
            const yTranslation = this.#toGridSize(deltaY);

            if (xTranslation === 0 && yTranslation === 0) {
              return;
            }

            this.dispatchEvent(
              new SelectionTranslateEvent(xTranslation, yTranslation)
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

            const xTranslation = this.#toGridSize(deltaX);
            const yTranslation = this.#toGridSize(deltaY);

            this.#dragStart = null;
            this.#translateStart = null;

            if (xTranslation === 0 && yTranslation === 0) {
              return;
            }

            this.dispatchEvent(
              new SelectionTranslateEvent(
                xTranslation,
                yTranslation,
                /** hasSettled */ true
              )
            );
          }}
        >
          ${this.nodeTitle}
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
