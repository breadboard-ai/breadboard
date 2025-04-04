/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { AssetEdge, DragConnectorReceiver } from "../../types/types";
import {
  AssetPath,
  Edge,
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import {
  AssetEdgeChangeEvent,
  DragConnectorCancelledEvent,
  EdgeChangeEvent,
  ToastEvent,
  ToastType,
} from "../../events/events";
import { collectNodeIds } from "./utils/collect-ids";
import { PortIdentifier } from "@google-labs/breadboard";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { NodeSelectEvent } from "./events/events";

const HEADER_ADJUSTMENT = 18;

@customElement("bb-drag-connector")
export class DragConnector extends LitElement {
  @property()
  accessor offset = new DOMPoint(0, 0);

  @property()
  accessor start: DOMPoint | null = null;

  @property()
  accessor graphId: GraphIdentifier | null = null;

  @property()
  accessor nodeId: NodeIdentifier | null = null;

  @property()
  accessor portId: PortIdentifier | null = null;

  @property()
  accessor assetPath: AssetPath | null = null;

  @property()
  accessor connectorType: "asset" | "node" = "node";

  @property()
  accessor end: DOMPoint | null = null;

  @property()
  accessor dimensions: { w: number; h: number } | null = null;

  @state()
  accessor isOnTarget = false;

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
      width: 100%;
      height: 100%;
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

  #targets = new Set<DragConnectorReceiver>();
  #onPointerMove(evt: PointerEvent) {
    const x = evt.clientX - this.offset.x;
    const y = evt.clientY - this.offset.y;
    this.end = new DOMPoint(x, y);

    let targetFound: EventTarget | null = null;
    for (const el of evt.composedPath()) {
      if (!this.#isDragConnectorReceiver(el)) {
        continue;
      }

      targetFound = el;
      this.#targets.add(el);
      if (el.isOnDragConnectorTarget()) {
        const { nodeId } = collectNodeIds(evt, "in");
        if (nodeId !== this.nodeId) {
          el.highlight();
          this.isOnTarget = true;
        } else {
          el.removeHighlight();
          this.isOnTarget = false;
        }
      } else {
        el.removeHighlight();
        this.isOnTarget = false;
      }
    }

    // Clean up any highlighted targets we've passed over.
    for (const target of this.#targets) {
      if (target === targetFound) {
        continue;
      }

      target.removeHighlight();
      this.#targets.delete(target);
    }
  }

  #onPointerUp(evt: MouseEvent) {
    let foundTarget = false;
    for (const el of evt.composedPath()) {
      if (!this.#isDragConnectorReceiver(el)) {
        continue;
      }

      if (el.isOnDragConnectorTarget()) {
        evt.stopImmediatePropagation();

        el.removeHighlight();
        this.isOnTarget = false;

        const { nodeId, graphId } = collectNodeIds(evt, "in");
        if (!nodeId || !graphId || !this.graphId) {
          break;
        }

        if (this.connectorType === "node" && nodeId === this.nodeId) {
          break;
        }

        if (this.connectorType === "asset" && !this.assetPath) {
          break;
        }

        foundTarget = true;

        if (graphId !== this.graphId) {
          this.dispatchEvent(
            new ToastEvent(
              "Connected items must belong in the same flow",
              ToastType.INFORMATION
            )
          );
          break;
        }

        if (this.connectorType === "node" && this.nodeId) {
          const from: Edge = {
            from: this.nodeId,
            to: nodeId,
          };

          this.dispatchEvent(
            new EdgeChangeEvent(
              "add",
              from,
              undefined,
              graphId === MAIN_BOARD_ID ? null : graphId
            )
          );
        } else if (this.connectorType === "asset" && this.assetPath) {
          const assetEdge: AssetEdge = {
            direction: "load",
            assetPath: this.assetPath,
            nodeId,
          };

          this.dispatchEvent(
            new AssetEdgeChangeEvent(
              "add",
              assetEdge,
              graphId === MAIN_BOARD_ID ? null : graphId
            )
          );
        }
        break;
      }
    }

    if (!foundTarget) {
      this.dispatchEvent(new DragConnectorCancelledEvent());
      this.dispatchEvent(
        new NodeSelectEvent(evt.clientX, evt.clientY - HEADER_ADJUSTMENT)
      );
    }

    this.#targets.clear();
    this.start = null;
    this.end = null;
    this.nodeId = null;
    this.portId = null;
    this.graphId = null;
    this.assetPath = null;
    window.removeEventListener("pointermove", this.#onPointerMoveBound);
  }

  #isDragConnectorReceiver(el: EventTarget): el is DragConnectorReceiver {
    return `isOnDragConnectorTarget` in el;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("start") && this.start) {
      this.start.x -= this.offset.x;
      this.start.y -= this.offset.y;
      this.end = DOMPoint.fromPoint(this.start);

      window.addEventListener("pointermove", this.#onPointerMoveBound);
      window.addEventListener("pointerup", this.#onPointerUpBound, {
        once: true,
        capture: true,
      });
    }
  }

  render() {
    if (!this.start || !this.end || !this.dimensions) {
      return nothing;
    }

    return html`${svg`<svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox=${`0 0 ${this.dimensions.w} ${this.dimensions.h}`}
    >
      <line
        x1="${this.start.x}"
        y1="${this.start.y}"
        x2="${this.end.x}"
        y2="${this.end.y}"
        stroke=${"#ffa500"}
        stroke-width="2"
      />
      <circle
        cx="${this.end.x}"
        cy="${this.end.y}"
        r="4"
        fill=${"#ffa500"}
      />
    </svg>`}`;
  }
}
