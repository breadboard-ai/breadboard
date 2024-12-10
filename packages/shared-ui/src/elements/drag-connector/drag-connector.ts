/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DragConnectorReceiver } from "../../types/types";
import { GraphIdentifier } from "@breadboard-ai/types";
import { NodeCreateReferenceEvent } from "../../events/events";
import { MAIN_BOARD_ID } from "../../constants/constants";

@customElement("bb-drag-connector")
export class DragConnector extends LitElement {
  @property()
  start: { x: number; y: number } | null = null;

  @property()
  source: GraphIdentifier | null = null;

  @property()
  end: { x: number; y: number } | null = null;

  @property()
  dimensions: { w: number; h: number } | null = null;

  #resizeObserver = new ResizeObserver((entries) => {
    this.dimensions = {
      w: entries[0].contentRect.width,
      h: entries[0].contentRect.height,
    };
  });

  static styles = css`
    :host {
      display: block;
      position: fixed;
      pointer-events: none;
      top: 0;
      left: 0;
      width: 100svw;
      height: 100svh;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();
  }

  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);

  #onPointerMove(evt: PointerEvent) {
    this.end = { x: evt.clientX, y: evt.clientY };

    for (const el of evt.composedPath()) {
      if (!this.#isDragConnectorReceiver(el)) {
        continue;
      }

      if (el.isOnDragConnectorTarget(evt.clientX, evt.clientY)) {
        el.highlight(evt.clientX, evt.clientY);
      } else {
        el.removeHighlight(evt.clientX, evt.clientY);
      }
    }
  }

  #onPointerUp(evt: PointerEvent) {
    for (const el of evt.composedPath()) {
      if (!this.#isDragConnectorReceiver(el)) {
        continue;
      }

      const target = el.isOnDragConnectorTarget(evt.clientX, evt.clientY);
      if (target) {
        el.removeHighlight(evt.clientX, evt.clientY);
        const [nodeId, portId] = target.split("|");
        if (!nodeId || !portId || !this.source) {
          break;
        }

        this.dispatchEvent(
          new NodeCreateReferenceEvent(
            MAIN_BOARD_ID,
            nodeId,
            portId,
            this.source
          )
        );
        break;
      }
    }

    this.start = null;
    this.end = null;
    window.removeEventListener("pointermove", this.#onPointerMoveBound);
  }

  #isDragConnectorReceiver(el: EventTarget): el is DragConnectorReceiver {
    return `isOnDragConnectorTarget` in el;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("start") && this.start) {
      window.addEventListener("pointermove", this.#onPointerMoveBound);
      window.addEventListener("pointerup", this.#onPointerUpBound, {
        once: true,
      });
    }
  }

  render() {
    if (!this.start || !this.end || !this.dimensions || !this.source) {
      return nothing;
    }

    return html`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox=${`0 0 ${this.dimensions.w} ${this.dimensions.h}`}
    >
      <circle cx=${this.start.x} cy=${this.start.y} r="3" fill="#ffa500" />
      <circle cx=${this.end.x} cy=${this.end.y} r="3" fill="#ffa500" />
      <line
        x1=${this.start.x}
        y1=${this.start.y}
        x2=${this.end.x}
        y2=${this.end.y}
        stroke-width="2"
        stroke="#ffa500"
      />
    </svg>`;
  }
}
