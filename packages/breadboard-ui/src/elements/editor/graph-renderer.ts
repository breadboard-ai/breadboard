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
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { GraphAssets } from "./graph-assets.js";
import { GraphEdge } from "./graph-edge.js";

@customElement("bb-graph-renderer")
export class GraphRenderer extends LitElement {
  @property({ reflect: true })
  editable = false;

  #app = new PIXI.Application();
  #overflowDeleteNode: Ref<HTMLButtonElement> = createRef();
  #overflowMinMaxSingleNode: Ref<HTMLButtonElement> = createRef();
  #overflowMenuRef: Ref<HTMLDivElement> = createRef();
  #overflowMenuGraphNode: GraphNode | null = null;
  #padding = 50;
  #container = new PIXI.Container();
  #background: PIXI.TilingSprite | null = null;
  #lastContentRect: DOMRectReadOnly | null = null;
  #resizeObserver = new ResizeObserver((entries) => {
    if ("resize" in this.#app) {
      this.#app.resize();
    }

    if (entries.length < 1) {
      return;
    }

    const { contentRect } = entries[0];
    const delta = new PIXI.Point(0, 0);
    if (this.#lastContentRect) {
      delta.x = (contentRect.width - this.#lastContentRect.width) * 0.5;
      delta.y = (contentRect.height - this.#lastContentRect.height) * 0.5;
    }

    for (const child of this.#container.children) {
      if (!(child instanceof Graph)) {
        continue;
      }

      // Inform the graph about the content rect so that it can attempt to fit
      // the graph inside of it.
      child.layoutRect = contentRect;

      // Reposition it to retain its center.
      const ratio = 1 / this.#container.scale.x;
      child.position.x += delta.x * ratio;
      child.position.y += delta.y * ratio;
    }

    this.#lastContentRect = contentRect;
  });

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onWheelBound = this.#onWheel.bind(this);

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }

    canvas {
      display: block;
      touch-action: none;
    }

    #overflow-menu {
      z-index: 1000;
      display: none;
      top: 0;
      left: 0;
      position: fixed;
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
      background: #ffffff;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      overflow: auto;
    }

    #overflow-menu.visible {
      display: grid;
      grid-template-rows: var(--bb-grid-size-11);
    }

    #overflow-menu button {
      display: flex;
      align-items: center;
      background: none;
      margin: 0;
      padding: var(--bb-grid-size-3);
      border: none;
      border-bottom: 1px solid var(--bb-neutral-300);
      text-align: left;
      cursor: pointer;
    }

    #overflow-menu button:hover,
    #overflow-menu button:focus {
      background: var(--bb-neutral-50);
    }

    #overflow-menu button:last-of-type {
      border: none;
    }

    #overflow-menu button::before {
      content: "";
      width: 20px;
      height: 20px;
      margin-right: var(--bb-grid-size-3);
    }

    #overflow-menu #min-max::before {
      background: var(--bb-icon-minimize) center center / 20px 20px no-repeat;
    }

    #overflow-menu #min-max.minimized::before {
      background: var(--bb-icon-maximize) center center / 20px 20px no-repeat;
    }

    #overflow-menu #min-max::after {
      content: "Minimize node";
    }

    #overflow-menu #min-max.minimized::after {
      content: "Maximize node";
    }

    #overflow-menu #delete-node::before {
      background: var(--bb-icon-delete) center center / 20px 20px no-repeat;
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
    // this.#app.stop();
    // this.#app.stop();
    this.tabIndex = 0;

    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let tilePosition: PIXI.ObservablePoint | null = null;
    this.#app.stage.addListener(
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

    this.#app.stage.addListener(
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
    this.#app.stage.addListener("pointerup", onPointerUp);
    this.#app.stage.addListener("pointerupoutside", onPointerUp);

    this.#app.stage.on(
      "wheel",
      function (this: GraphRenderer, evt) {
        let delta = 1 - evt.deltaY / this.zoomFactor;
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

  #scaleContainerAroundPoint(delta: number, pivot: PIXI.PointData) {
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
    this.#container.setFromMatrix(m);
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

    graph.on(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW, () => this.zoomToFit());

    graph.on(GRAPH_OPERATIONS.GRAPH_DRAW, () => {
      graph.layout();
    });

    graph.on(
      GRAPH_OPERATIONS.GRAPH_NODE_MENU_REQUESTED,
      (graphNode: GraphNode, location: PIXI.ObservablePoint) => {
        if (!this.#overflowMenuRef.value) {
          return;
        }

        const overflowMenu = this.#overflowMenuRef.value;
        overflowMenu.classList.add("visible");
        overflowMenu.style.translate = `${location.x}px ${location.y}px`;

        if (this.#overflowMinMaxSingleNode.value) {
          this.#overflowMinMaxSingleNode.value.classList.toggle(
            "minimized",
            graphNode.collapsed
          );
        }

        this.#overflowMenuGraphNode = graphNode;

        window.addEventListener(
          "pointerdown",
          (evt: Event) => {
            if (!this.#overflowMenuGraphNode) {
              return;
            }

            const [topItem] = evt.composedPath();
            switch (topItem) {
              case this.#overflowMinMaxSingleNode.value: {
                this.#overflowMenuGraphNode.collapsed =
                  !this.#overflowMenuGraphNode.collapsed;
                break;
              }

              case this.#overflowDeleteNode.value: {
                if (!this.#overflowMenuGraphNode.label) {
                  console.warn("Tried to delete unnamed node");
                  break;
                }

                if (!confirm("Are you sure you want to delete this node?")) {
                  return;
                }

                this.dispatchEvent(
                  new GraphNodeDeleteEvent(this.#overflowMenuGraphNode.label)
                );
                break;
              }
            }

            overflowMenu.classList.remove("visible");
            this.#overflowMenuGraphNode = null;
          },
          { once: true }
        );
      }
    );

    this.#container.addChild(graph);
  }

  zoomToFit() {
    this.#container.scale.set(1, 1);

    // Find the first graph in the container and size to it.
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

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

      return;
    }
  }

  resetGraphLayout() {
    for (const graph of this.#container.children) {
      if (!(graph instanceof Graph)) {
        continue;
      }

      graph.clearNodeLayoutPositions();
      graph.layout();

      this.dispatchEvent(
        new GraphNodePositionsCalculatedEvent(graph.getNodeLayoutPositions())
      );
    }
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

      const selectedChild = graph.getSelectedChild();
      if (!selectedChild) {
        continue;
      }

      if (selectedChild instanceof GraphNode) {
        if (!selectedChild.label) {
          console.warn("Node has no name - unable to delete");
          return;
        }
        this.dispatchEvent(new GraphNodeDeleteEvent(selectedChild.label));
      } else if (selectedChild instanceof GraphEdge) {
        if (!selectedChild.edge) {
          console.warn("Invalid edge - unable to delete");
          return;
        }
        this.dispatchEvent(new GraphNodeEdgeDetachEvent(selectedChild.edge));
      }
    }
  }

  #onWheel(evt: WheelEvent) {
    evt.preventDefault();
  }

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#onKeyDownBound);

    this.addEventListener("wheel", this.#onWheelBound, { passive: false });

    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    if ("stop" in this.#app) {
      this.#app.stop();
    }

    this.#resizeObserver.disconnect();
    window.removeEventListener("keydown", this.#onKeyDownBound);
    this.removeEventListener("wheel", this.#onWheelBound);
  }

  async loadTexturesAndRender() {
    await Promise.all([
      GraphAssets.instance().loaded,
      this.#app.init({
        webgpu: {
          background: "#ededed",
          antialias: true,
        },
        webgl: {
          background: "#ededed",
          antialias: true,
        },
        preference: "webgl",
        resizeTo: this,
        autoDensity: true,
        resolution: Math.max(2, window.devicePixelRatio),
        eventMode: "static",
        eventFeatures: {
          globalMove: true,
          move: true,
          click: true,
          wheel: true,
        },
      }),
    ]);

    if (!this.#background) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.warn("Unable to create background texture");
        return;
      }
      ctx.fillStyle = "#ededed";
      ctx.fillRect(0, 0, 1, 1);

      const texture = PIXI.Texture.from(canvas);

      this.#background = new PIXI.TilingSprite(texture);
      this.#background.width = this.#app.canvas.width;
      this.#background.height = this.#app.canvas.height;

      this.#app.stage.addChildAt(this.#background, 0);
    } else {
      this.#app.stage.addChildAt(this.#background, 0);
    }

    this.#app.start();
    this.#app.resize();
    this.#app.renderer.addListener("resize", () => {
      if (!this.#background) {
        return;
      }

      this.#background.width = this.#app.renderer.width;
      this.#background.height = this.#app.renderer.height;
    });

    return this.#app.canvas;
  }

  render() {
    const overflowMenu = html`<div
      ${ref(this.#overflowMenuRef)}
      id="overflow-menu"
    >
      <button id="min-max" ${ref(this.#overflowMinMaxSingleNode)}></button>
      <button id="delete-node" ${ref(this.#overflowDeleteNode)}>
        Delete node
      </button>
    </div>`;

    return html`${until(this.loadTexturesAndRender())}${overflowMenu}`;
  }
}
