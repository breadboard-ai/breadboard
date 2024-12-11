/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { DragConnectorReceiver } from "../../types/types";
import { GraphIdentifier } from "@breadboard-ai/types";
import {
  DragConnectorCancelledEvent,
  NodeCreateReferenceEvent,
} from "../../events/events";
import { getSubItemColor } from "../../utils/subgraph-color";

const documentStyles = getComputedStyle(document.documentElement);
type ValidColorStrings = `#${number}` | `--${string}`;

export function getGlobalColor(
  name: ValidColorStrings,
  defaultValue: ValidColorStrings = "#333333"
) {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  const valueAsNumber = parseInt(value || defaultValue, 16);
  if (Number.isNaN(valueAsNumber)) {
    return 0xff00ff;
  }
  return valueAsNumber;
}

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

  @state()
  isOnTarget = false;

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
        this.isOnTarget = true;
      } else {
        el.removeHighlight(evt.clientX, evt.clientY);
        this.isOnTarget = false;
      }
    }
  }

  #onPointerUp(evt: MouseEvent) {
    let foundTarget = false;
    for (const el of evt.composedPath()) {
      if (!this.#isDragConnectorReceiver(el)) {
        continue;
      }

      const target = el.isOnDragConnectorTarget(evt.clientX, evt.clientY);
      if (target) {
        evt.stopImmediatePropagation();

        el.removeHighlight(evt.clientX, evt.clientY);
        this.isOnTarget = false;

        const [graphId, nodeId, portId] = target.split("|");
        if (!graphId || !nodeId || !portId || !this.source) {
          break;
        }

        foundTarget = true;
        this.dispatchEvent(
          new NodeCreateReferenceEvent(graphId, nodeId, portId, this.source)
        );
        break;
      }
    }

    if (!foundTarget) {
      this.dispatchEvent(new DragConnectorCancelledEvent());
    }

    this.start = null;
    this.end = null;
    document.body.classList.remove("boards-highlight");
    window.removeEventListener("pointermove", this.#onPointerMoveBound);
  }

  #isDragConnectorReceiver(el: EventTarget): el is DragConnectorReceiver {
    return `isOnDragConnectorTarget` in el;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("start") && this.start) {
      document.body.classList.add("boards-highlight");

      this.end = { ...this.start };

      window.addEventListener("pointermove", this.#onPointerMoveBound);
      window.addEventListener("pointerup", this.#onPointerUpBound, {
        once: true,
        capture: true,
      });
    }
  }

  render() {
    if (!this.start || !this.end || !this.dimensions || !this.source) {
      return nothing;
    }

    const fillColor = this.isOnTarget
      ? `#${getGlobalColor("--bb-joiner-500").toString(16).padStart(2)}`
      : getSubItemColor<string>(
          this.source.replace(/^#(module:)?/, ""),
          "label"
        );

    return html`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox=${`0 0 ${this.dimensions.w} ${this.dimensions.h}`}
    >
      <circle
        cx="${this.end.x}"
        cy="${this.end.y}"
        r="10"
        fill="${fillColor}"
      />
      <line
        x1="${this.end.x - 5}"
        y1="${this.end.y}"
        x2="${this.end.x + 5}"
        y2="${this.end.y}"
        stroke="white"
        stroke-width="2"
      />
      <line
        x1="${this.end.x}"
        y1="${this.end.y - 5}"
        x2="${this.end.x}"
        y2="${this.end.y + 5}"
        stroke="white"
        stroke-width="2"
      />
    </svg>`;
  }
}
