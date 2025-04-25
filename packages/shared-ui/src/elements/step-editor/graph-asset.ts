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
  NodeSelectEvent,
  SelectionTranslateEvent,
} from "./events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { toGridSize } from "./utils/to-grid-size";
import { DragConnectorReceiver } from "../../types/types";
import { DragConnectorStartEvent } from "../../events/events";
import { getGlobalColor } from "../../utils/color.js";
import { AssetPath, LLMContent } from "@breadboard-ai/types";
import { InspectableAsset, ok } from "@google-labs/breadboard";
import { SignalWatcher } from "@lit-labs/signals";
import { GraphAsset as GraphAssetState } from "../../state/types.js";
import { icons } from "../../styles/icons.js";

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

@customElement("bb-graph-asset")
export class GraphAsset
  extends SignalWatcher(Box)
  implements DragConnectorReceiver
{
  @property()
  accessor assetTitle = "";

  @property({ reflect: true })
  accessor icon: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor updating = true;

  @property({ reflect: true, type: String })
  accessor highlightType: "user" | "model" = "model";

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property()
  accessor showDefaultAdd = false;

  @property()
  accessor asset: InspectableAsset | null = null;

  @property()
  accessor graphUrl: URL | null = null;

  @property()
  accessor state: GraphAssetState | null = null;

  static styles = [
    icons,
    Box.styles,
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

      :host {
        --background: var(--bb-inputs-50);
        --border: var(--bb-neutral-500);
        --header-border: var(--bb-inputs-300);
      }

      :host([updating]) {
        --background: var(--bb-neutral-100);
        --border: var(--bb-neutral-600);
        --header-border: var(--bb-neutral-300);
      }

      :host([selected]) #container {
        outline: 2px solid var(--border);
      }

      #container {
        width: 260px;
        border-radius: var(--bb-grid-size-3);
        outline: 1px solid var(--border);
        color: var(--bb-neutral-900);
        position: relative;

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
          cursor: pointer;
          position: relative;
          justify-content: center;

          & span:not(.g-icon) {
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          }

          & span.g-icon {
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
          padding: var(--bb-grid-size-2) var(--bb-grid-size-2);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-900);
          line-height: var(--bb-grid-size-6);
          border-radius: 0 0 var(--bb-grid-size-3) var(--bb-grid-size-3);
          pointer-events: none;
          max-height: 320px;
          overflow: hidden;

          & .loading {
            margin: 0;
          }

          bb-llm-output {
            --output-lite-border-color: transparent;
            --output-border-radius: var(--bb-grid-size);
          }
        }
      }

      :host([updating]) #container #content bb-llm-output {
        clip-path: rect(0 0 0 0);
        height: 0px;
      }
    `,
  ];

  #translateStart: DOMPoint | null = null;
  #dragStart: DOMPoint | null = null;
  #containerRef: Ref<HTMLElement> = createRef();
  #lastBounds: DOMRect | null = null;
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

  constructor(public readonly assetPath: AssetPath) {
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
      changedProperties.has("assetTitle") ||
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
              new NodeSelectEvent(target.x + 16, target.y, this.assetPath)
            );
          }}
        >
          ${Strings.from("LABEL_ADD_ITEM")}
        </button>`;
    }

    let icon = "alternate_email";
    if (this.asset?.subType) {
      switch (this.asset.subType) {
        case "youtube":
          icon = "video_youtube";
          break;
        case "drawable":
          icon = "draw";
          break;
        case "gdrive":
          icon = "drive";
          break;
      }
    }

    return html`<section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
        ${ref(this.#containerRef)}
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

            this.dispatchEvent(
              new SelectionTranslateEvent(
                xTranslation,
                yTranslation,
                /* hasSettled */ true
              )
            );
          }}
        >
          <span class="g-icon">${icon}</span>
          <span>${this.assetTitle}</span>
          ${defaultAdd}
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
                  "asset",
                  new DOMPoint(evt.clientX, evt.clientY)
                )
              );
            }}
          >
            Connect to..
          </button>
        </header>
        <div
          id="content"
          @pointerdown=${(evt: Event) => {
            evt.stopImmediatePropagation();
          }}
        >
          ${this.updating
            ? html`<p class="loading">Loading asset details...</p>`
            : nothing}
          ${html`<bb-llm-output
            @outputsloaded=${() => {
              this.updating = false;
            }}
            .value=${this.#getPreviewValue()}
            .clamped=${false}
            .lite=${true}
            .showPDFControls=${false}
            .showModeToggle=${false}
            .showEntrySelector=${false}
            .showExportControls=${false}
            .graphUrl=${this.graphUrl}
          ></bb-llm-output>`}
        </div>
      </section>

      ${this.renderBounds()}`;
  }

  #getPreviewValue(): LLMContent | null {
    let context: LLMContent[] | undefined;
    if (this.asset?.type === "connector") {
      const preview = this.state?.connector?.preview;
      if (!preview || !ok(preview)) return null;
      context = preview;
    } else {
      context = this.asset?.data;
    }
    return context?.at(-1) ?? null;
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
