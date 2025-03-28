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
import { GRID_SIZE } from "./constants";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { intersects } from "./utils/rect-intersection";
import { getGlobalColor } from "../../utils/color";
import { clamp } from "./utils/clamp";

interface Connection {
  n1: DOMPoint;
  n2: DOMPoint;
  s1: "Top" | "Right" | "Bottom" | "Left";
  s2: "Top" | "Right" | "Bottom" | "Left";
}

const EDGE_STANDARD = getGlobalColor("--bb-neutral-400");
const EDGE_SELECTED = getGlobalColor("--bb-ui-600");

// Value is no longer on the wire, because it was consumed by the receiving
// component. Constant wires never reach this state.
const EDGE_CONSUMED = getGlobalColor("--bb-input-600");

// Value is on the wire, but hasn't been consumed by receiving component yet.
const EDGE_STORED = getGlobalColor("--bb-human-600");

const HALF_HEADER_HEIGHT = 18;
const LINE_CLEARANCE = 8;
const ARROW_SIZE = 8;

@customElement("bb-graph-edge")
export class GraphEdge extends Box {
  @property()
  accessor status: "consumed" | "initial" | "stored" | null = null;

  static styles = [
    Box.styles,
    css`
      :host {
        z-index: 1;
      }

      :host([selected]) {
        z-index: 2;
      }

      svg {
        pointer-events: none;
      }

      svg > * {
        pointer-events: auto;
        cursor: pointer;
      }
    `,
  ];

  #edgeRef: Ref<SVGSVGElement> = createRef();
  #edgeHitAreaRef: Ref<SVGPathElement> = createRef();

  constructor(
    public readonly node1: GraphNode,
    public readonly node2: GraphNode,
    public readonly edgeId: string
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

  intersects(targetBounds: DOMRect, padding = 0) {
    const boundsIntersection = super.intersects(targetBounds, padding);
    if (!boundsIntersection) {
      return false;
    }

    // Check the edge graphic more closely.
    if (!this.#edgeRef.value) {
      return false;
    }

    // Get the SVG's bounding box and convert it to a world coordinates bounding
    // box. Then use that for the intersection calculation.
    const localBounds = this.#edgeRef.value.getBBox();
    const tl = new DOMPoint(localBounds.x, localBounds.y).matrixTransform(
      this.worldTransform
    );
    const tr = new DOMPoint(
      localBounds.x + localBounds.width,
      localBounds.y
    ).matrixTransform(this.worldTransform);
    const bl = new DOMPoint(
      localBounds.x,
      localBounds.y + localBounds.height
    ).matrixTransform(this.worldTransform);

    // Coarse intersection check. If we aren't even in the bounding box area for
    // this edge then don't consider it further.
    const worldBounds = new DOMRect(tl.x, tl.y, tr.x - tl.x, bl.y - tl.y);
    if (!intersects(worldBounds, targetBounds, padding)) {
      return false;
    }

    // Refined intersection check. Here we transform the target bounds of the
    // selection into an SVGRect that is in the SVG's coordinate system. From
    // there we can use the built-in checkIntersection method to see if it
    // intersects with the path.
    //
    // If there's no hit area then bail but assume there was an intersection.
    if (!this.#edgeHitAreaRef.value) {
      return true;
    }

    // Now perform the more refined check.
    const inverseWorldTransform = this.worldTransform.inverse();
    const intersectTL = new DOMPoint(
      targetBounds.x,
      targetBounds.y
    ).matrixTransform(inverseWorldTransform);
    const intersectTR = new DOMPoint(
      targetBounds.x + targetBounds.width,
      targetBounds.y
    ).matrixTransform(inverseWorldTransform);
    const intersectBL = new DOMPoint(
      targetBounds.x,
      targetBounds.y + targetBounds.height
    ).matrixTransform(inverseWorldTransform);

    const selectBox = this.#edgeRef.value.createSVGRect();
    selectBox.x = intersectTL.x;
    selectBox.y = intersectTL.y;
    selectBox.width = intersectTR.x - intersectTL.x;
    selectBox.height = intersectBL.y - intersectTL.y;

    return this.#edgeRef.value.checkIntersection(
      this.#edgeHitAreaRef.value,
      selectBox
    );
  }

  #calculateShortestPath() {
    // Node 1 points.
    const n1l = new DOMPoint(this.node1.bounds.x, HALF_HEADER_HEIGHT);
    const n1r = new DOMPoint(
      this.node1.bounds.x + this.node1.bounds.width,
      HALF_HEADER_HEIGHT
    );
    const n1t = new DOMPoint(
      this.node1.bounds.x + this.node1.bounds.width * 0.5,
      this.node1.bounds.y
    );
    const n1b = new DOMPoint(
      this.node1.bounds.x + this.node1.bounds.width * 0.5,
      this.node1.bounds.y + this.node1.bounds.height
    );

    // Node 2 points.
    const n2l = new DOMPoint(this.node2.bounds.x - 2, HALF_HEADER_HEIGHT);
    const n2r = new DOMPoint(
      this.node2.bounds.x + this.node2.bounds.width + 2,
      HALF_HEADER_HEIGHT
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
    cSP(n1r, n2t, t1, t2, "Right", "Top");
    cSP(n1r, n2l, t1, t2, "Right", "Left");
    cSP(n1r, n2b, t1, t2, "Right", "Bottom");

    // Bottom.
    cSP(n1b, n2r, t1, t2, "Bottom", "Right");
    cSP(n1b, n2t, t1, t2, "Bottom", "Top");
    cSP(n1b, n2l, t1, t2, "Bottom", "Left");

    // Left.
    cSP(n1l, n2t, t1, t2, "Left", "Top");
    cSP(n1l, n2r, t1, t2, "Left", "Right");
    cSP(n1l, n2b, t1, t2, "Left", "Bottom");

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
      const dir =
        connectionPoints.s1 === "Left" && connectionPoints.s2 === "Right"
          ? -1
          : 1;
      const clearance =
        Math.min(
          Math.abs(connectionPoints.n2.x - connectionPoints.n1.x) / 2,
          LINE_CLEARANCE
        ) * dir;

      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `L ${connectionPoints.n1.x + clearance} ${connectionPoints.n1.y}`,
        `C ${midX} ${connectionPoints.n1.y}, ${midX} ${connectionPoints.n2.y}, ${connectionPoints.n2.x - clearance} ${connectionPoints.n2.y}`,
        `L ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
      );
    } else if (
      (connectionPoints.s1 === "Bottom" && connectionPoints.s2 === "Top") ||
      (connectionPoints.s1 === "Top" && connectionPoints.s2 === "Bottom")
    ) {
      const dir =
        connectionPoints.s1 === "Top" && connectionPoints.s2 === "Bottom"
          ? -1
          : 1;
      const clearance =
        Math.min(
          Math.abs(connectionPoints.n2.y - connectionPoints.n1.y) / 2,
          LINE_CLEARANCE
        ) * dir;

      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `L ${connectionPoints.n1.x} ${connectionPoints.n1.y + clearance}`,
        `C ${connectionPoints.n1.x} ${midY}, ${connectionPoints.n2.x} ${midY}, ${connectionPoints.n2.x} ${connectionPoints.n2.y - clearance}`,
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
        `C ${connectionPoints.n1.x} ${midY}, ${connectionPoints.n1.x} ${connectionPoints.n2.y}, ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
      );
    } else if (
      (connectionPoints.s1 === "Right" && connectionPoints.s2 === "Top") ||
      (connectionPoints.s1 === "Left" && connectionPoints.s2 === "Top") ||
      (connectionPoints.s1 === "Left" && connectionPoints.s2 === "Bottom") ||
      (connectionPoints.s1 === "Right" && connectionPoints.s2 === "Bottom")
    ) {
      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `C ${midX} ${connectionPoints.n1.y}, ${connectionPoints.n2.x} ${connectionPoints.n1.y}, ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
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
    if (intersects(this.node1.worldBounds, this.node2.worldBounds, 0)) {
      return nothing;
    }

    const styles: Record<string, string> = {
      transform: toCSSMatrix(this.worldTransform),
    };

    const connectionPoints = this.#calculateShortestPath();
    const rotation = this.#createRotationFromConnectionPoints(connectionPoints);
    const steps = this.#createStepsFromConnectionPoints(connectionPoints);
    let arrowSize = ARROW_SIZE;
    if (connectionPoints.s2 === "Top") {
      arrowSize = clamp(
        connectionPoints.n2.y - connectionPoints.n1.y,
        0,
        ARROW_SIZE
      );
    } else if (connectionPoints.s2 === "Bottom") {
      arrowSize = clamp(
        connectionPoints.n1.y - connectionPoints.n2.y,
        0,
        ARROW_SIZE
      );
    } else if (connectionPoints.s2 === "Left") {
      arrowSize = clamp(
        connectionPoints.n2.x - connectionPoints.n1.x,
        0,
        ARROW_SIZE
      );
    } else if (connectionPoints.s2 === "Right") {
      arrowSize = clamp(
        connectionPoints.n1.x - connectionPoints.n2.x,
        0,
        ARROW_SIZE
      );
    }

    let edgeColor;
    switch (this.status) {
      case "stored": {
        edgeColor = EDGE_STORED;
        break;
      }

      case "consumed": {
        edgeColor = EDGE_CONSUMED;
        break;
      }

      case "initial":
      default: {
        edgeColor = EDGE_STANDARD;
        break;
      }
    }

    return html`<section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
      >
        ${svg`
          <svg ${ref(this.#edgeRef)} version="1.1"
               width=${this.bounds.width} height=${this.bounds.height}
               xmlns="http://www.w3.org/2000/svg">
                <path d=${steps.join(" ")}
                  stroke=${this.selected ? EDGE_SELECTED : edgeColor}
                  stroke-width="2" fill="none" stroke-linecap="round" />

                <path ${ref(this.#edgeHitAreaRef)} d=${steps.join(" ")}
                  stroke="#ff00ff00"
                  stroke-width="10" fill="none" stroke-linecap="round" />

                <line x1=${connectionPoints.n2.x}
                  y1=${connectionPoints.n2.y}
                  x2=${connectionPoints.n2.x - arrowSize}
                  y2=${connectionPoints.n2.y - arrowSize}
                  transform=${`rotate(${rotation}, ${connectionPoints.n2.x}, ${connectionPoints.n2.y})`}
                  stroke=${this.selected ? EDGE_SELECTED : edgeColor} stroke-width="2" stroke-linecap="round" />

                <line x1=${connectionPoints.n2.x} y1=${connectionPoints.n2.y}
                x2=${connectionPoints.n2.x - arrowSize}
                y2=${connectionPoints.n2.y + arrowSize}
                transform=${`rotate(${rotation}, ${connectionPoints.n2.x}, ${connectionPoints.n2.y})`}
                stroke=${this.selected ? EDGE_SELECTED : edgeColor} stroke-width="2" stroke-linecap="round" />
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
