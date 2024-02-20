/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableEdge } from "@google-labs/breadboard";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as PIXI from "pixi.js";
import {
  GraphNodeDblClickEvent,
  GraphNodeDelete,
  GraphNodeEdgeAttach,
  GraphNodeEdgeChange,
  GraphNodeEdgeDetach,
} from "../../events/events.js";
import { InteractionTracker } from "./interaction-tracker.js";
import { GraphNode } from "./graph-node.js";
import {
  GRAPH_INITIAL_DRAW,
  GRAPH_NODE_MOVED,
  GraphNodePortType,
} from "./types.js";
import { Graph } from "./graph.js";

@customElement("bb-graph-renderer")
export class GraphRenderer extends LitElement {
  @property({ reflect: true })
  editable = false;

  #app = new PIXI.Application({
    background: "rgb(244, 247, 252)",
    resizeTo: this,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
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

  #onKeyDownBound = this.#onKeyDown.bind(this);

  static styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }

    canvas {
      display: block;
    }
  `;

  #distanceSq(a: PIXI.Point, b: PIXI.Point) {
    const x = a.x - b.x;
    const y = a.y - b.y;
    return x * x + y * y;
  }

  constructor(
    private minScale = 0.1,
    private maxScale = 4,
    private zoomFactor = 100
  ) {
    super();

    this.#app.stage.addChild(this.#container);
    this.#app.stage.eventMode = "static";

    let lastClickTime = Number.NEGATIVE_INFINITY;
    let lastClickPosition: PIXI.Point = new PIXI.Point(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY
    );

    this.#app.stage.on(
      "pointerdown",
      function (this: GraphRenderer, evt) {
        const interactionTracker = InteractionTracker.instance();
        const activeGraphNodePort = interactionTracker.activeGraphNodePort;
        const activeGraphNode = interactionTracker.activeGraphNode;
        const hoveredGraphNode = interactionTracker.hoveredGraphNode;
        const hoveredGraphNodePort = interactionTracker.hoveredGraphNodePort;
        const activeGraph = interactionTracker.activeGraph;
        const target =
          hoveredGraphNodePort || hoveredGraphNode || this.#container;

        const now = window.performance.now();
        const clickPosition = evt.global.clone();
        const timeDelta = now - lastClickTime;
        const positionDelta = this.#distanceSq(
          clickPosition,
          lastClickPosition
        );
        lastClickTime = now;
        lastClickPosition = clickPosition;

        // Double click - edit the node.
        if (
          positionDelta < 500 &&
          timeDelta < 500 &&
          target instanceof GraphNode
        ) {
          interactionTracker.clear();
          this.dispatchEvent(new GraphNodeDblClickEvent(target.id));
          return;
        }

        let onPointerUp: (evt: PointerEvent) => void;
        let onPointerMove: (evt: PointerEvent) => void;
        if (
          activeGraphNodePort &&
          activeGraphNode &&
          activeGraph &&
          activeGraph.editable
        ) {
          if (!activeGraphNode.name) {
            console.warn("Unnamed graph node.");
            return;
          }

          let edgeGraphic = activeGraph.findEdge(
            activeGraphNode.name,
            activeGraphNodePort
          );

          let snapToPort = true;
          let portType = activeGraphNodePort.type;
          if (!edgeGraphic) {
            edgeGraphic = activeGraph.createTemporaryEdge({
              from: { descriptor: { id: activeGraphNode.name } },
              to: { descriptor: { id: activeGraphNode.name } },
              out: activeGraphNodePort.name,
              in: activeGraphNodePort.name,
            } as InspectableEdge);

            // Swap the port type for temporary edges because if we're dragging
            // from an OUT port we are inherently creating an IN port elsewhere.
            portType =
              portType === GraphNodePortType.IN
                ? GraphNodePortType.OUT
                : GraphNodePortType.IN;
            snapToPort = false;
          }

          if (!edgeGraphic || !edgeGraphic.edge) {
            console.warn("Unable to create graphic");
            return;
          }

          // Hide a temporary edge until the user drags it away.
          if (edgeGraphic.temporary) {
            edgeGraphic.visible = false;
          }

          // Snapshot some values here so that we can use them whenever the
          // user hovers and we need to start tracking again.
          const overrideBaseLocation = activeGraphNodePort.position.clone();
          const edgeIn = edgeGraphic.edge.in;
          const edgeOut = edgeGraphic.edge.out;
          const toNode = edgeGraphic.toNode;
          const fromNode = edgeGraphic.fromNode;

          onPointerMove = () => {
            if (!edgeGraphic || !edgeGraphic.edge) {
              return;
            }

            edgeGraphic.forceRedraw();

            // If hovering over a port, snap to it.
            if (
              interactionTracker.hoveredGraphNode &&
              interactionTracker.hoveredGraphNodePort &&
              portType === interactionTracker.hoveredGraphNodePort.type &&
              snapToPort
            ) {
              edgeGraphic.overrideInLocation = null;
              edgeGraphic.overrideOutLocation = null;
              edgeGraphic.overrideColor = 0xffa500;

              const name = interactionTracker.hoveredGraphNodePort.name || "";
              if (portType === GraphNodePortType.IN) {
                edgeGraphic.edge.in = name;
                edgeGraphic.toNode = interactionTracker.hoveredGraphNode;
              } else {
                edgeGraphic.edge.out = name;
                edgeGraphic.fromNode = interactionTracker.hoveredGraphNode;
              }

              interactionTracker.hoveredGraphNodePort.active = true;
              return;
            }

            edgeGraphic.overrideColor = 0xffcc00;

            // Otherwise track to the mouse.
            if (
              interactionTracker.hoveredGraphNodePort === null &&
              !snapToPort
            ) {
              snapToPort = true;
              edgeGraphic.visible = true;
            }

            if (portType === GraphNodePortType.IN) {
              if (!edgeGraphic.overrideInLocation) {
                edgeGraphic.overrideInLocation = overrideBaseLocation;
                edgeGraphic.edge.in = edgeIn;
                edgeGraphic.edge.out = edgeOut;
                edgeGraphic.toNode = toNode;
                edgeGraphic.fromNode = fromNode;
              }

              activeGraphNode.toLocal(
                evt.global,
                undefined,
                edgeGraphic.overrideInLocation
              );
            } else {
              if (!edgeGraphic.overrideOutLocation) {
                edgeGraphic.overrideOutLocation = overrideBaseLocation;
                edgeGraphic.edge.in = edgeIn;
                edgeGraphic.edge.out = edgeOut;
                edgeGraphic.toNode = toNode;
                edgeGraphic.fromNode = fromNode;
              }

              activeGraphNode.toLocal(
                evt.global,
                undefined,
                edgeGraphic.overrideOutLocation
              );
            }
          };

          onPointerUp = () => {
            if (edgeGraphic) {
              edgeGraphic.overrideColor = null;

              if (edgeGraphic.temporary) {
                edgeGraphic.removeFromParent();
                edgeGraphic.destroy();
              }
            }

            // Snapshot everything we need, then clear it out. After that we
            // do the value processing.
            const hoveredGraphNode = interactionTracker.hoveredGraphNode;
            const hoveredGraphNodePort =
              interactionTracker.hoveredGraphNodePort;
            const activeGraphNodePort = interactionTracker.activeGraphNodePort;
            const hoveredGraphNodePortType =
              interactionTracker.hoveredGraphNodePort?.type;

            interactionTracker.clear();
            document.removeEventListener("pointermove", onPointerMove);

            if (
              // The ports exist
              hoveredGraphNodePort &&
              activeGraphNodePort &&
              // The port types match
              hoveredGraphNodePortType === portType
            ) {
              // Update existing.
              if (!edgeGraphic || !edgeGraphic.edge) {
                console.warn("Unable to attach - no edge found");
                return;
              }
              if (!hoveredGraphNode) {
                console.warn("Unable to attach - no node found");
                return;
              }
              const newTargetNodeName = hoveredGraphNode.name;
              const newTargetNodePortName = hoveredGraphNodePort.name;
              const newTargetNode = activeGraph.nodes?.find(
                (node) => node.descriptor.id === newTargetNodeName
              );
              if (!newTargetNode || !newTargetNodePortName) {
                console.warn("Unable to attach - no edge found");
                return;
              }

              // Reset the original edge.
              const from = edgeGraphic.edge;
              from.in = edgeIn;
              from.out = edgeOut;

              // Create the new edge from the original.
              let to: InspectableEdge;
              if (portType === GraphNodePortType.IN) {
                to = {
                  ...edgeGraphic.edge,
                  in: newTargetNodePortName,
                  to: newTargetNode,
                };
              } else {
                to = {
                  ...edgeGraphic.edge,
                  out: newTargetNodePortName,
                  from: newTargetNode,
                };
              }

              if (edgeGraphic.temporary) {
                this.dispatchEvent(new GraphNodeEdgeAttach(to));
              } else {
                // Noop change - do nothing.
                if (
                  from.from === to.from &&
                  from.to === to.to &&
                  from.in === to.in &&
                  from.out === to.out
                ) {
                  return;
                }

                this.dispatchEvent(new GraphNodeEdgeChange(from, to));
              }
            } else {
              if (!edgeGraphic || !edgeGraphic.edge) {
                console.warn("Unable to update - no edge found");
                return;
              }

              if (edgeGraphic.temporary) {
                return;
              }

              // Detach.
              this.dispatchEvent(new GraphNodeEdgeDetach(edgeGraphic.edge));
            }
          };
        } else {
          const zIndex = target.parent.children.length;
          const dragStart = this.#app.stage.toLocal(evt.global);
          const originalPosition = target.position.clone();

          let tilePosition: PIXI.ObservablePoint<unknown> | null = null;
          if (this.#background && target === this.#container) {
            tilePosition = this.#background.tilePosition.clone();
          }

          onPointerMove = () => {
            if (!dragStart) {
              return;
            }

            const dragPosition = this.#app.stage.toLocal(evt.global);
            let dragDeltaX = dragPosition.x - dragStart.x;
            let dragDeltaY = dragPosition.y - dragStart.y;

            if (target !== this.#container) {
              dragDeltaX /= this.#container.scale.x;
              dragDeltaY /= this.#container.scale.y;
            }

            target.x = originalPosition.x + dragDeltaX;
            target.y = originalPosition.y + dragDeltaY;
            target.zIndex = zIndex;

            // For container moves we update the background position.
            if (
              this.#background &&
              target === this.#container &&
              tilePosition
            ) {
              this.#background.tilePosition.x = tilePosition.x + dragDeltaX;
              this.#background.tilePosition.y = tilePosition.y + dragDeltaY;
            } else {
              target.emit(GRAPH_NODE_MOVED, target.x, target.y);
            }
          };

          onPointerUp = () => {
            if (target.zIndex) {
              target.zIndex = Math.max(0, target.parent.children.length - 1);
            }

            if (target === this.#container) {
              interactionTracker.clear();
            }

            document.removeEventListener("pointermove", onPointerMove);
          };
        }

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp, { once: true });
      },
      this
    );

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

    // Apply back to the container.
    this.#container.transform.setFromMatrix(m);
    return m;
  }

  addGraph(graph: Graph) {
    graph.editable = this.editable;

    graph.on(GRAPH_INITIAL_DRAW, () => {
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

    const interactionTracker = InteractionTracker.instance();
    const activeGraphNode = interactionTracker.activeGraphNode;
    if (!activeGraphNode || !activeGraphNode.name) {
      return;
    }

    interactionTracker.clear();
    this.dispatchEvent(new GraphNodeDelete(activeGraphNode.name));
  }

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#onKeyDownBound);

    this.#app.resize();
    this.#app.renderer.addListener("resize", () => {
      if (!this.#background) {
        return;
      }

      this.#background.width = this.#app.renderer.width;
      this.#background.height = this.#app.renderer.height;
    });

    if (!this.#background) {
      PIXI.Texture.fromURL("/images/pattern.png").then((texture) => {
        this.#background = new PIXI.TilingSprite(texture);
        this.#background.width = this.#app.renderer.width;
        this.#background.height = this.#app.renderer.height;

        this.#app.stage.addChildAt(this.#background, 0);
      });
    } else {
      this.#app.stage.addChildAt(this.#background, 0);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  render() {
    return html`${this.#app.view}`;
  }
}
