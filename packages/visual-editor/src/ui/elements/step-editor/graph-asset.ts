/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetPath, InspectableAsset, LLMContent } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { SignalWatcher } from "@lit-labs/signals";
import { css, html, HTMLTemplateResult, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { notebookLmIcon } from "../../styles/svg-icons.js";
import { styleMap } from "lit/directives/style-map.js";
import { DragConnectorStartEvent } from "../../events/events.js";
import { GraphAsset as GraphAssetState } from "../../../sca/types.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { DragConnectorReceiver } from "../../types/types.js";
import { Box } from "./box.js";
import {
  NodeBoundsUpdateRequestEvent,
  SelectionTranslateEvent,
} from "./events/events.js";
import { toCSSMatrix } from "./utils/to-css-matrix.js";
import { toGridSize } from "./utils/to-grid-size.js";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";

@customElement("bb-graph-asset")
export class GraphAsset
  extends SignalWatcher(Box)
  implements DragConnectorReceiver
{
  @property()
  accessor ownerGraph = "";

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

  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    type,
    baseColors,
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
        color: var(--light-dark-n-10);
        line-height: var(--bb-grid-size-6);
        z-index: 3;
        outline: none;
      }

      :host([selected]) {
        z-index: 4;
      }

      :host {
        --background: var(--ui-asset);
      }

      :host([updating]) {
        --background: var(--light-dark-n-70);
      }

      :host([selected]) #container {
        outline: 3px solid var(--light-dark-n-0);
      }

      #container {
        width: 300px;
        border-radius: calc(var(--bb-grid-size-3) + 1px);
        color: light-dark(var(--n-10), var(--n-0));
        position: relative;
        cursor: pointer;
        border: 1px solid light-dark(var(--n-90), var(--n-30));

        #right-arrow {
          position: absolute;
          top: 0px;
          left: 100%;
          width: 46px;
          height: 48px;
        }

        #default-add {
          position: absolute;
          top: 18px;
          left: 100%;
          transform: translateX(48px) translateY(-50%);
          z-index: 4;
          border: 1px solid var(--light-dark-n-90);
          color: var(--light-dark-n-50);
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          border-radius: var(--bb-grid-size-16);
          background: var(--light-dark-n-98) var(--bb-icon-library-add) 8px
            center / 20px 20px no-repeat;
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
          transition: border 0.2s cubic-bezier(0, 0, 0.3, 1);
          height: var(--bb-grid-size-7);
          cursor: pointer;
          white-space: nowrap;
          pointer-events: auto;

          &:hover {
            border: 1px solid var(--light-dark-n-98);
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
          cursor: pointer;
          position: relative;
          z-index: 3;
          color: light-dark(var(--n-0), var(--n-10));

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
            background: var(--light-dark-n-100);
            right: -5px;
            top: 24px;
            translate: 0 -50%;
            font-size: 0;
            padding: 0;
            outline: 2px solid var(--light-dark-n-0);

            &::after {
              content: "";
              position: absolute;
              display: block;
              width: 4px;
              height: 4px;
              border-radius: 50%;
              background: var(--light-dark-n-0);
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
          background: light-dark(var(--n-100), var(--n-20));
          padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: light-dark(var(--n-10), var(--n-90));
          line-height: var(--bb-grid-size-6);
          border-radius: 0 0 var(--bb-grid-size-3) var(--bb-grid-size-3);
          pointer-events: none;
          max-height: 320px;
          overflow: hidden;

          & #content-container {
            height: 100%;
            width: 100%;
            padding: 0;
            max-height: 296px;
            overflow: hidden;
          }

          & .loading {
            margin: 0;
          }

          bb-llm-output {
            --output-lite-border-color: transparent;
            --output-lite-background-color: transparent;
            --output-border-radius: var(--bb-grid-size);
            margin-bottom: 0;
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
      transform: toCSSMatrix(this.worldTransform, this.force2D),
    };

    let icon: string | HTMLTemplateResult = "text_fields";
    if (this.asset?.type === "file") {
      icon = "upload";
    }

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
        case "notebooklm":
          icon = notebookLmIcon;
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
          class="sans-flex round w-500"
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
          <span class="g-icon filled round">${icon}</span>
          <span>${this.assetTitle}</span>
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
          <div id="content-container">
            <bb-llm-output
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
            ></bb-llm-output>
          </div>
        </div>
      </section>

      ${this.renderBounds()}`;
  }

  #getPreviewValue(): LLMContent | null {
    const context = this.asset?.data;
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
