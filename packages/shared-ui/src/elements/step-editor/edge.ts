/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { customElement, property } from "lit/decorators.js";
import { Box } from "./box";
import { GraphNode } from "./graph-node";
import { css, html, svg } from "lit";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { GRID_SIZE } from "./constants";

interface Connection {
  n1: DOMPoint;
  n2: DOMPoint;
  s1: "Top" | "Right" | "Bottom" | "Left";
  s2: "Top" | "Right" | "Bottom" | "Left";
}

@customElement("bb-graph-edge")
export class GraphEdge extends Box {
  static styles = [
    Box.styles,
    css`
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
    const candidates: Connection = {
      n1: new DOMPoint(),
      n2: new DOMPoint(),
      s1: "Top",
      s2: "Top",
    };
    const cSP = (
      n1: DOMPoint,
      n2: DOMPoint,
      t1: DOMPoint,
      t2: DOMPoint,
      s1: "Top" | "Right" | "Bottom" | "Left",
      s2: "Top" | "Right" | "Bottom" | "Left"
    ) => {
      const dist = this.#distanceSq(n1, n2, t1, t2);
      if (dist > smallestDist) {
        return;
      }

      if (dist === smallestDist) {
        return;
      }

      smallestDist = dist;

      candidates.n1.x = n1.x + t1.x;
      candidates.n1.y = n1.y + t1.y;
      candidates.n2.x = n2.x + t2.x;
      candidates.n2.y = n2.y + t2.y;
      candidates.s1 = s1;
      candidates.s2 = s2;
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
    cSP(n1t, n2l, t1, t2, "Top", "Left");
    cSP(n1t, n2b, t1, t2, "Top", "Bottom");
    cSP(n1t, n2r, t1, t2, "Top", "Right");

    // Right.
    if (
      this.node2.transform.e >
      this.node1.transform.e + this.node1.bounds.width
    ) {
      cSP(n1r, n2t, t1, t2, "Right", "Top");
      cSP(n1r, n2l, t1, t2, "Right", "Left");
      cSP(n1r, n2b, t1, t2, "Right", "Bottom");
    }

    // Bottom.
    cSP(n1b, n2r, t1, t2, "Bottom", "Right");
    cSP(n1b, n2t, t1, t2, "Bottom", "Top");
    cSP(n1b, n2l, t1, t2, "Bottom", "Left");

    // Left.
    if (
      this.node2.transform.e + this.node2.bounds.width <
      this.node1.transform.e
    ) {
      cSP(n1l, n2t, t1, t2, "Left", "Top");
      cSP(n1l, n2r, t1, t2, "Left", "Right");
      cSP(n1l, n2b, t1, t2, "Left", "Bottom");
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

  #createStepsFromConnectionPoints(connectionPoints: Connection) {
    const steps: string[] = [];

    const midX =
      connectionPoints.n1.x +
      (connectionPoints.n2.x - connectionPoints.n1.x) * 0.5;

    const midY =
      connectionPoints.n1.y +
      (connectionPoints.n2.y - connectionPoints.n1.y) * 0.5;

    if (
      (connectionPoints.s1 === "Right" && connectionPoints.s2 === "Left") ||
      (connectionPoints.s1 === "Left" && connectionPoints.s2 === "Right")
    ) {
      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `L ${midX} ${connectionPoints.n1.y}`,
        `L ${midX} ${connectionPoints.n2.y}`,
        `L ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
      );
    } else if (
      (connectionPoints.s1 === "Bottom" && connectionPoints.s2 === "Top") ||
      (connectionPoints.s1 === "Top" && connectionPoints.s2 === "Bottom")
    ) {
      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `L ${connectionPoints.n1.x} ${midY}`,
        `L ${connectionPoints.n2.x} ${midY}`,
        `L ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
      );
    } else if (
      (connectionPoints.s1 === "Bottom" && connectionPoints.s2 === "Left") ||
      (connectionPoints.s1 === "Top" && connectionPoints.s2 === "Right") ||
      (connectionPoints.s1 === "Bottom" && connectionPoints.s2 === "Right") ||
      (connectionPoints.s1 === "Top" && connectionPoints.s2 === "Left")
    ) {
      // Maybe adjust.
      if (
        connectionPoints.s1 === "Bottom" &&
        connectionPoints.s2 === "Left" &&
        connectionPoints.n1.x > connectionPoints.n2.x - GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x - GRID_SIZE;
      } else if (
        connectionPoints.s1 === "Bottom" &&
        connectionPoints.s2 === "Right" &&
        connectionPoints.n1.x < connectionPoints.n2.x + GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x + GRID_SIZE;
      } else if (
        connectionPoints.s1 === "Top" &&
        connectionPoints.s2 === "Right" &&
        connectionPoints.n1.x < connectionPoints.n2.x + GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x + GRID_SIZE;
      } else if (
        connectionPoints.s1 === "Top" &&
        connectionPoints.s2 === "Left" &&
        connectionPoints.n1.x > connectionPoints.n2.x - GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x - GRID_SIZE;
      }

      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `L ${connectionPoints.n1.x} ${connectionPoints.n2.y}`,
        `L ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
      );
    } else if (
      (connectionPoints.s1 === "Right" && connectionPoints.s2 === "Top") ||
      (connectionPoints.s1 === "Left" && connectionPoints.s2 === "Top") ||
      (connectionPoints.s1 === "Left" && connectionPoints.s2 === "Bottom") ||
      (connectionPoints.s1 === "Right" && connectionPoints.s2 === "Bottom")
    ) {
      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `L ${connectionPoints.n2.x} ${connectionPoints.n1.y}`,
        `L ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
      );
    }

    return steps;
  }

  #createRotationFromConnectionPoints(connectionPoints: Connection) {
    let rotation = 0;
    switch (connectionPoints.s2) {
      case "Top":
        rotation = 90;
        break;
      case "Right":
        rotation = 180;
        break;
      case "Bottom":
        rotation = 270;
        break;
    }

    return rotation;
  }

  protected renderSelf() {
    const styles: Record<string, string> = {
      transform: toCSSMatrix(this.worldTransform),
    };

    const arrowSize = 8;
    const connectionPoints = this.#calculateShortestPath();
    const rotation = this.#createRotationFromConnectionPoints(connectionPoints);
    const steps = this.#createStepsFromConnectionPoints(connectionPoints);

    return html`<section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
      >
        ${svg`
          <svg version="1.1"
               width=${this.bounds.width} height=${this.bounds.height}
               xmlns="http://www.w3.org/2000/svg">
                <path d=${steps.join(" ")}
                  stroke="#c2c2c2"
                  stroke-width="2" fill="none" />

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
      html`${map(this.entities, (entity) => {
        return html`${entity}`;
      })}`,
    ];
  }
}
