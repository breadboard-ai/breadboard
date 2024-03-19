/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as PIXI from "pixi.js";
import {
  GraphNodeSelectedEvent,
  GraphNodeDeleteEvent,
  GraphNodeEdgeAttachEvent,
  GraphNodeEdgeChangeEvent,
  GraphNodeEdgeDetachEvent,
  GraphNodeMoveEvent,
  GraphNodePositionsCalculatedEvent,
} from "../../events/events.js";
import { GRAPH_OPERATIONS } from "./types.js";
import { Graph } from "./graph.js";
import { InspectableEdge } from "@google-labs/breadboard";
import { GraphNode } from "./graph-node.js";

@customElement("bb-graph-renderer")
export class GraphRenderer extends LitElement {
  @property({ reflect: true })
  editable = false;

  #app = new PIXI.Application({
    background: "rgb(244, 247, 252)",
    resizeTo: this,
    antialias: true,
    autoDensity: true,
    resolution: Math.max(2, window.devicePixelRatio),
    eventMode: "static",
    eventFeatures: {
      globalMove: true,
      move: true,
      click: true,
      wheel: true,
    },
  });
  #padding = 50;
  #container = new PIXI.Container();
  #background: PIXI.TilingSprite | null = null;
  #resizeObserver = new ResizeObserver((entries) => {
    this.#app.resize();

    if (entries.length < 1) {
      return;
    }

    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        continue;
      }

      // Inform the graph about the content rect so that it can attempt to fit
      // the graph inside of it.
      child.layoutRect = entries[0].contentRect;
    }
  });

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onWheelBound = this.#onWheel.bind(this);

  static styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }

    canvas {
      display: block;
      touch-action: none;
    }
  `;

  constructor(
    private minScale = 0.1,
    private maxScale = 4,
    private zoomFactor = 100
  ) {
    super();

    this.#app.stage.addChild(this.#container);
    this.#app.stage.eventMode = "static";
    this.#app.stop();
    this.tabIndex = 0;

    let dragStart: PIXI.IPointData | null = null;
    let originalPosition: PIXI.ObservablePoint<unknown> | null = null;
    let tilePosition: PIXI.ObservablePoint<unknown> | null = null;
    this.#app.stage.addEventListener(
      "pointerdown",
      (evt: PIXI.FederatedPointerEvent) => {
        for (const graph of this.#container.children) {
          if (!(graph instanceof Graph)) {
            continue;
          }

          graph.deselectAllChildren();
        }

        dragStart = this.#app.stage.toLocal(evt.global);
        originalPosition = this.#container.position.clone();

        if (!this.#background) {
          return;
        }
        tilePosition = this.#background.tilePosition.clone();
      }
    );

    this.#app.stage.addEventListener(
      "pointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!dragStart || !originalPosition) {
          return;
        }

        const dragPosition = this.#app.stage.toLocal(evt.global);
        const dragDeltaX = dragPosition.x - dragStart.x;
        const dragDeltaY = dragPosition.y - dragStart.y;

        this.#container.x = Math.round(originalPosition.x + dragDeltaX);
        this.#container.y = Math.round(originalPosition.y + dragDeltaY);

        if (!this.#background || !tilePosition) {
          return;
        }
        this.#background.tilePosition.x = tilePosition.x + dragDeltaX;
        this.#background.tilePosition.y = tilePosition.y + dragDeltaY;
      }
    );

    const onPointerUp = () => {
      dragStart = null;
      originalPosition = null;
      tilePosition = null;
    };
    this.#app.stage.addEventListener("pointerup", onPointerUp);
    this.#app.stage.addEventListener("pointerupoutside", onPointerUp);

    this.#app.stage.on(
      "wheel",
      function (this: GraphRenderer, evt) {
        let delta = 1 + evt.deltaY / this.zoomFactor;
        const newScale = this.#container.scale.x * delta;
        if (newScale < this.minScale || newScale > this.maxScale) {
          delta = 1;
        }

        const pivot = this.#app.stage.toLocal(evt.global);
        const matrix = this.#scaleContainerAroundPoint(delta, pivot);

        if (!this.#background) {
          return;
        }

        this.#background.tileTransform.setFromMatrix(matrix);
      },
      this
    );
  }

  #scaleContainerAroundPoint(delta: number, pivot: PIXI.IPointData) {
    const m = new PIXI.Matrix();
    m.identity()
      .scale(this.#container.scale.x, this.#container.scale.y)
      .translate(this.#container.x, this.#container.y);

    // Update with the mousewheel position & delta.
    m.translate(-pivot.x, -pivot.y)
      .scale(delta, delta)
      .translate(pivot.x, pivot.y);

    // Ensure that it is always on a square pixel.
    m.tx = Math.round(m.tx);
    m.ty = Math.round(m.ty);

    // Apply back to the container.
    this.#container.transform.setFromMatrix(m);
    return m;
  }

  addGraph(graph: Graph) {
    graph.editable = this.editable;

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_MOVED,
      (id: string, x: number, y: number) => {
        this.dispatchEvent(new GraphNodeMoveEvent(id, x, y));
      }
    );

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_DETAILS_REQUESTED,
      (id: string | null) => {
        this.dispatchEvent(new GraphNodeSelectedEvent(id));
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_EDGE_ATTACH, (edge: InspectableEdge) => {
      this.dispatchEvent(new GraphNodeEdgeAttachEvent(edge));
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_EDGE_DETACH, (edge: InspectableEdge) => {
      this.dispatchEvent(new GraphNodeEdgeDetachEvent(edge));
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_EDGE_CHANGE,
      (from: InspectableEdge, to: InspectableEdge) => {
        this.dispatchEvent(new GraphNodeEdgeChangeEvent(from, to));
      }
    );

    graph.on(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW, () => {
      this.#container.scale.set(1, 1);

      const graphPosition = graph.getGlobalPosition();
      const graphBounds = graph.getBounds();
      const rendererBounds = this.getBoundingClientRect();

      // Dagre isn't guaranteed to start the layout at 0, 0, so we adjust things
      // back here so that the scaling calculations work out.
      graphBounds.x -= graphPosition.x;
      graphBounds.y -= graphPosition.y;
      graph.position.set(-graphBounds.x, -graphBounds.y);
      this.#container.position.set(
        (rendererBounds.width - graphBounds.width) * 0.5,
        (rendererBounds.height - graphBounds.height) * 0.5
      );
      const delta = Math.min(
        (rendererBounds.width - 2 * this.#padding) / graphBounds.width,
        (rendererBounds.height - 2 * this.#padding) / graphBounds.height,
        1
      );

      if (delta < this.minScale) {
        this.minScale = delta;
      }

      const pivot = {
        x: rendererBounds.width / 2,
        y: rendererBounds.height / 2,
      };
      this.#scaleContainerAroundPoint(delta, pivot);

      this.dispatchEvent(
        new GraphNodePositionsCalculatedEvent(graph.getNodeLayoutPositions())
      );
    });

    graph.on(GRAPH_OPERATIONS.GRAPH_DRAW, () => {
      graph.layout();
    });

    this.#container.addChild(graph);
  }

  removeGraph(graph: Graph) {
    graph.removeFromParent();
    graph.destroy();
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.code !== "Backspace") {
      return;
    }

    const [target] = evt.composedPath();
    if (target !== this) {
      return;
    }

    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      for (const child of graph.children) {
        if (!(child instanceof GraphNode) || !child.name || !child.selected) {
          continue;
        }

        this.dispatchEvent(new GraphNodeDeleteEvent(child.name));
      }
    }
  }

  #onWheel(evt: WheelEvent) {
    evt.preventDefault();
  }

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#onKeyDownBound);

    this.addEventListener("wheel", this.#onWheelBound);

    this.#app.start();
    this.#app.resize();
    this.#app.renderer.addListener("resize", () => {
      if (!this.#background) {
        return;
      }

      this.#background.width = this.#app.renderer.width;
      this.#background.height = this.#app.renderer.height;
    });

    this.#resizeObserver.observe(this);

    if (!this.#background) {
      const buffer = new Uint8Array([0xed, 0xed, 0xed]);
      const texture = PIXI.Texture.fromBuffer(buffer, 1, 1, {
        type: PIXI.TYPES.UNSIGNED_BYTE,
        format: PIXI.FORMATS.RGB,
        mipmap: PIXI.MIPMAP_MODES.OFF,
        scaleMode: PIXI.SCALE_MODES.LINEAR,
      });

      this.#background = new PIXI.TilingSprite(texture);
      this.#background.width = this.#app.renderer.width;
      this.#background.height = this.#app.renderer.height;

      this.#app.stage.addChildAt(this.#background, 0);
    } else {
      this.#app.stage.addChildAt(this.#background, 0);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#app.stop();
    this.#resizeObserver.disconnect();
    window.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("wheel", this.#onWheelBound);
  }

  render() {
    return html`${this.#app.view}`;
  }
}
