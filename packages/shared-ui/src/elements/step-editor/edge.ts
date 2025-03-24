/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { customElement, property } from "lit/decorators.js";
import { Box } from "./box";
import { GraphNode } from "./graph-node";
import { css, html, nothing, svg } from "lit";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { DEGRAD, GRID_SIZE } from "./constants";
import { intersects } from "./utils/rect-intersection";

@customElement("bb-graph-edge")
export class GraphEdge extends Box {
  static styles = [
    Box.styles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        z-index: 0;
      }
    `,
  ];

  @property()
  accessor location = "bottom";

  constructor(
    public readonly node1: GraphNode,
    public readonly node2: GraphNode
  ) {
    super();

    this.cullable = true;
  }

  calculateLocalBounds(): DOMRect {
    const top = Math.min(this.node1.transform.f, this.node2.transform.f);
    const bottom = Math.max(
      this.node1.transform.f + this.node1.bounds.height,
      this.node2.transform.f + this.node2.bounds.height
    );
    const left = Math.min(this.node1.transform.e, this.node2.transform.e);
    const right = Math.max(
      this.node1.transform.e + this.node1.bounds.width,
      this.node2.transform.e + this.node2.bounds.width
    );

    this.transform.e = left;
    this.transform.f = top;

    const width = right - left;
    const height = bottom - top;

    return new DOMRect(0, 0, width, height);
  }

  /**
   * Figures out the shortest path from the cardinal points on node 1 to the
   * cardinal points on node 2.
   */
  #calculateShortestPath() {
    // Node 1 cardinal points.
    const n1l = new DOMPoint(
      this.node1.bounds.x,
      Math.floor((this.node1.bounds.height * 0.5) / GRID_SIZE) * GRID_SIZE
    );
    const n1r = new DOMPoint(
      this.node1.bounds.x + this.node1.bounds.width,
      Math.floor((this.node1.bounds.height * 0.5) / GRID_SIZE) * GRID_SIZE
    );
    const n1t = new DOMPoint(
      this.node1.bounds.x + this.node1.bounds.width * 0.5,
      this.node1.bounds.y
    );
    const n1b = new DOMPoint(
      this.node1.bounds.x + this.node1.bounds.width * 0.5,
      this.node1.bounds.y + this.node1.bounds.height
    );

    // Node 2 cardinal points.
    const n2l = new DOMPoint(
      this.node2.bounds.x - 2,
      Math.floor((this.node2.bounds.height * 0.5) / GRID_SIZE) * GRID_SIZE
    );
    const n2r = new DOMPoint(
      this.node2.bounds.x + this.node2.bounds.width + 2,
      Math.floor((this.node2.bounds.height * 0.5) / GRID_SIZE) * GRID_SIZE
    );
    const n2t = new DOMPoint(
      this.node2.bounds.x + this.node2.bounds.width * 0.5,
      this.node2.bounds.y - 2
    );
    const n2b = new DOMPoint(
      this.node2.bounds.x + this.node2.bounds.width * 0.5,
      this.node2.bounds.y + this.node2.bounds.height + 2
    );

    // Set up the smallest distance and the candidates.
    let smallestDist = Number.POSITIVE_INFINITY;
    const candidates = { n1: new DOMPoint(), n2: new DOMPoint() };
    const cSP = (
      n1: DOMPoint,
      n2: DOMPoint,
      t1: DOMPoint,
      t2: DOMPoint,
      cardinal = false
    ) => {
      const dist = this.#distanceSq(n1, n2, t1, t2);
      if (dist > smallestDist) {
        return;
      }

      // Prefer cardinal points when there is a contest for shortest distance.
      if (dist === smallestDist && !cardinal) {
        return;
      }

      smallestDist = dist;

      candidates.n1.x = n1.x + t1.x;
      candidates.n1.y = n1.y + t1.y;
      candidates.n2.x = n2.x + t2.x;
      candidates.n2.y = n2.y + t2.y;
    };

    const t1 = new DOMPoint(
      this.node1.transform.e - this.transform.e,
      this.node1.transform.f - this.transform.f
    );
    const t2 = new DOMPoint(
      this.node2.transform.e - this.transform.e,
      this.node2.transform.f - this.transform.f
    );

    // Top.
    cSP(n1t, n2l, t1, t2, true);
    cSP(n1t, n2b, t1, t2, true);
    cSP(n1t, n2r, t1, t2, true);

    // Right.
    if (
      this.node2.transform.e >
      this.node1.transform.e + this.node1.bounds.width
    ) {
      cSP(n1r, n2t, t1, t2, true);
      cSP(n1r, n2l, t1, t2, true);
      cSP(n1r, n2b, t1, t2, true);
    }

    // Bottom.
    cSP(n1b, n2r, t1, t2, true);
    cSP(n1b, n2t, t1, t2, true);
    cSP(n1b, n2l, t1, t2, true);

    // Left.
    if (
      this.node2.transform.e + this.node2.bounds.width <
      this.node1.transform.e
    ) {
      cSP(n1l, n2t, t1, t2, true);
      cSP(n1l, n2r, t1, t2, true);
      cSP(n1l, n2b, t1, t2, true);
    }

    return candidates;
  }

  #distanceSq(p1: DOMPoint, p2: DOMPoint, t1: DOMPoint, t2: DOMPoint) {
    const x1 = p1.x + t1.x;
    const y1 = p1.y + t1.y;
    const x2 = p2.x + t2.x;
    const y2 = p2.y + t2.y;

    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  }

  protected renderSelf() {
    // In the event that there is an intersection we will simply hide the edge.
    if (intersects(this.node1.worldBounds, this.node2.worldBounds)) {
      return nothing;
    }

    const styles: Record<string, string> = {
      transform: toCSSMatrix(this.worldTransform),
    };

    const arrowSize = 8;
    const connectionPoints = this.#calculateShortestPath();
    const rotation =
      Math.atan2(
        connectionPoints.n2.y - connectionPoints.n1.y,
        connectionPoints.n2.x - connectionPoints.n1.x
      ) / DEGRAD;
    return html`<section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
      >
        ${svg`
          <svg version="1.1"
               width=${this.bounds.width} height=${this.bounds.height}
               xmlns="http://www.w3.org/2000/svg">
                <line x1=${connectionPoints.n1.x}
                  y1=${connectionPoints.n1.y}
                  x2=${connectionPoints.n2.x}
                  y2=${connectionPoints.n2.y}
                  stroke="#c2c2c2"
                  stroke-width="2" />

                <line x1=${connectionPoints.n2.x}
                  y1=${connectionPoints.n2.y}
                  x2=${connectionPoints.n2.x - arrowSize}
                  y2=${connectionPoints.n2.y - arrowSize}
                  transform=${`rotate(${rotation}, ${connectionPoints.n2.x}, ${connectionPoints.n2.y})`}
                  stroke="#c2c2c2" stroke-width="2" stroke-linecap="round" />

                <line x1=${connectionPoints.n2.x} y1=${connectionPoints.n2.y}
                x2=${connectionPoints.n2.x - arrowSize}
                y2=${connectionPoints.n2.y + arrowSize}
                transform=${`rotate(${rotation}, ${connectionPoints.n2.x}, ${connectionPoints.n2.y})`}
                stroke="#c2c2c2" stroke-width="2" stroke-linecap="round" />
          </svg>
        `}
      </section>
      ${this.renderBounds()}`;
  }

  render() {
    return [
      this.renderSelf(),
      html`${map(this.entities.values(), (entity) => {
        entity.showBounds = this.showBounds;
        return html`${entity}`;
      })}`,
    ];
  }
}
