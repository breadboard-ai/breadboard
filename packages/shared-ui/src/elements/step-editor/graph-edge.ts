/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { customElement, property } from "lit/decorators.js";
import { Box } from "./box";
import { GraphNode } from "./graph-node";
import { css, html, HTMLTemplateResult, nothing, svg } from "lit";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { GRID_SIZE } from "./constants";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { intersects } from "./utils/rect-intersection";
import { getGlobalColor } from "../../utils/color";
import { clamp } from "./utils/clamp";
import { EdgeAttachmentPoint } from "../../types/types";
import { inspectableEdgeToString } from "../../utils/workspace";
import { InspectableEdge } from "@google-labs/breadboard";
import { GraphEdgeAttachmentMoveEvent } from "./events/events";

interface Connection {
  n1: DOMPoint;
  n2: DOMPoint;
  from: "Top" | "Right" | "Bottom" | "Left";
  to: "Top" | "Right" | "Bottom" | "Left";
}

const EDGE_STANDARD = getGlobalColor("--bb-neutral-400");
const EDGE_SELECTED = getGlobalColor("--bb-ui-600");

// Value is no longer on the wire, because it was consumed by the receiving
// component. Constant wires never reach this state.
const EDGE_CONSUMED = getGlobalColor("--bb-input-600");

// Value is on the wire, but hasn't been consumed by receiving component yet.
const EDGE_STORED = getGlobalColor("--bb-human-600");

// Value is on the wire, but hasn't been consumed by receiving component yet.
const EDGE_USER = getGlobalColor("--bb-joiner-600");
const EDGE_MODEL = getGlobalColor("--bb-generative-600");

const HALF_HEADER_HEIGHT = 18;
const LINE_CLEARANCE = 8;
const ARROW_SIZE = 8;

type NodeBoundPoints = {
  n1t: DOMPoint;
  n1r: DOMPoint;
  n1b: DOMPoint;
  n1l: DOMPoint;
  n2t: DOMPoint;
  n2r: DOMPoint;
  n2b: DOMPoint;
  n2l: DOMPoint;
};

const CONNECTION_POINT_RADIUS = 8;

@customElement("bb-graph-edge")
export class GraphEdge extends Box {
  @property()
  accessor status: "consumed" | "initial" | "stored" | null = null;

  @property({ reflect: true, type: Boolean })
  accessor showEdgePointSelectors = false;

  @property({ reflect: true, type: String })
  accessor highlightType: "user" | "model" = "user";

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  static styles = [
    Box.styles,
    css`
      :host {
        z-index: 1;
      }

      :host([selected]) {
        z-index: 2;
      }

      :host([selected][showedgepointselectors]) {
        z-index: 3;
      }

      svg {
        pointer-events: none;
      }

      svg > * {
        pointer-events: auto;
      }

      #edge > *,
      #point-selectors > * {
        cursor: pointer;
      }

      #point-selectors {
        position: absolute;
        top: -8px;
        left: -8px;
        pointer-events: auto;
        z-index: 4;
      }
    `,
  ];

  #edgeRef: Ref<SVGSVGElement> = createRef();
  #edgeHitAreaRef: Ref<SVGPathElement> = createRef();

  @property()
  accessor from: EdgeAttachmentPoint = "Auto";

  @property()
  accessor to: EdgeAttachmentPoint = "Auto";

  constructor(
    public readonly node1: GraphNode,
    public readonly node2: GraphNode,
    public readonly edge: InspectableEdge
  ) {
    super();

    this.cullable = true;
  }

  get edgeId() {
    return inspectableEdgeToString(this.edge);
  }

  set edgeId(_edgeId: string) {
    throw new Error("Unable to set edge ID - read only");
  }

  calculateLocalBounds(): DOMRect {
    const top = Math.min(
      this.node1.transform.f - 25,
      this.node2.transform.f - 25
    );
    const bottom = Math.max(
      this.node1.transform.f + this.node1.bounds.height + 50,
      this.node2.transform.f + this.node2.bounds.height + 50
    );
    const left = Math.min(this.node1.transform.e, this.node2.transform.e - 25);
    const right = Math.max(
      this.node1.transform.e + this.node1.bounds.width + 50,
      this.node2.transform.e + this.node2.bounds.width + 50
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

    console.log("in");

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

  #getNodeBoundPoints(): NodeBoundPoints {
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
    const n2l = new DOMPoint(this.node2.bounds.x, HALF_HEADER_HEIGHT);
    const n2r = new DOMPoint(
      this.node2.bounds.x + this.node2.bounds.width,
      HALF_HEADER_HEIGHT
    );
    const n2t = new DOMPoint(
      this.node2.bounds.x + this.node2.bounds.width * 0.5,
      this.node2.bounds.y
    );
    const n2b = new DOMPoint(
      this.node2.bounds.x + this.node2.bounds.width * 0.5,
      this.node2.bounds.y + this.node2.bounds.height
    );

    const t1 = new DOMPoint(
      this.node1.transform.e - this.transform.e,
      this.node1.transform.f - this.transform.f
    );

    const t2 = new DOMPoint(
      this.node2.transform.e - this.transform.e,
      this.node2.transform.f - this.transform.f
    );

    const applyTransform = (n: DOMPoint, t: DOMPoint) => {
      n.x += t.x;
      n.y += t.y;
    };

    applyTransform(n1t, t1);
    applyTransform(n1r, t1);
    applyTransform(n1b, t1);
    applyTransform(n1l, t1);

    applyTransform(n2t, t2);
    applyTransform(n2r, t2);
    applyTransform(n2b, t2);
    applyTransform(n2l, t2);

    return {
      n1t,
      n1r,
      n1b,
      n1l,
      n2t,
      n2r,
      n2b,
      n2l,
    };
  }

  #calculateConnectionPoints({
    n1t,
    n1r,
    n1b,
    n1l,
    n2t,
    n2r,
    n2b,
    n2l,
  }: NodeBoundPoints) {
    // Set up the smallest distance and the candidates.
    let smallestDist = Number.POSITIVE_INFINITY;
    const candidates: Connection = {
      n1: new DOMPoint(),
      n2: new DOMPoint(),
      from: "Top",
      to: "Top",
    };

    const calculateShortestPath = (
      n1: DOMPoint,
      n2: DOMPoint,
      from: "Top" | "Right" | "Bottom" | "Left",
      to: "Top" | "Right" | "Bottom" | "Left"
    ) => {
      const dist = this.#distanceSq(n1, n2);
      if (dist > smallestDist) {
        return;
      }

      if (dist === smallestDist) {
        return;
      }

      smallestDist = dist;

      candidates.n1.x = n1.x;
      candidates.n1.y = n1.y;
      candidates.n2.x = n2.x;
      candidates.n2.y = n2.y;
      candidates.from = from;
      candidates.to = to;
    };

    const copyPoint = (src: DOMPointReadOnly, dest: DOMPoint) => {
      dest.x = src.x;
      dest.y = src.y;
    };

    // Top.
    calculateShortestPath(n1t, n2l, "Top", "Left");
    calculateShortestPath(n1t, n2b, "Top", "Bottom");
    calculateShortestPath(n1t, n2r, "Top", "Right");

    // Right.
    calculateShortestPath(n1r, n2t, "Right", "Top");
    calculateShortestPath(n1r, n2l, "Right", "Left");
    calculateShortestPath(n1r, n2b, "Right", "Bottom");

    // Bottom.
    calculateShortestPath(n1b, n2r, "Bottom", "Right");
    calculateShortestPath(n1b, n2t, "Bottom", "Top");
    calculateShortestPath(n1b, n2l, "Bottom", "Left");

    // Left.
    calculateShortestPath(n1l, n2t, "Left", "Top");
    calculateShortestPath(n1l, n2r, "Left", "Right");
    calculateShortestPath(n1l, n2b, "Left", "Bottom");

    if (this.from === "Top") copyPoint(n1t, candidates.n1);
    if (this.from === "Right") copyPoint(n1r, candidates.n1);
    if (this.from === "Bottom") copyPoint(n1b, candidates.n1);
    if (this.from === "Left") copyPoint(n1l, candidates.n1);

    if (this.to === "Top") copyPoint(n2t, candidates.n2);
    if (this.to === "Right") copyPoint(n2r, candidates.n2);
    if (this.to === "Bottom") copyPoint(n2b, candidates.n2);
    if (this.to === "Left") copyPoint(n2l, candidates.n2);

    if (this.from !== "Auto") {
      candidates.from = this.from;
    }

    if (this.to !== "Auto") {
      candidates.to = this.to;
    }

    // Final adjustments so that the arrow has a bit of breathing room before it
    // goes into the node.
    if (candidates.from === "Left") candidates.n1.x -= 4;
    if (candidates.from === "Right") candidates.n1.x += 4;
    if (candidates.from === "Top") candidates.n1.y -= 4;
    if (candidates.from === "Bottom") candidates.n1.y += 4;
    if (candidates.to === "Left") candidates.n2.x -= 4;
    if (candidates.to === "Right") candidates.n2.x += 4;
    if (candidates.to === "Top") candidates.n2.y -= 4;
    if (candidates.to === "Bottom") candidates.n2.y += 4;

    return candidates;
  }

  #distanceSq(p1: DOMPoint, p2: DOMPoint) {
    const x1 = p1.x;
    const y1 = p1.y;
    const x2 = p2.x;
    const y2 = p2.y;

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
      (connectionPoints.from === "Right" && connectionPoints.to === "Left") ||
      (connectionPoints.from === "Left" && connectionPoints.to === "Right") ||
      (connectionPoints.from === "Left" && connectionPoints.to === "Left") ||
      (connectionPoints.from === "Right" && connectionPoints.to === "Right")
    ) {
      const dir =
        connectionPoints.from === "Left" && connectionPoints.to === "Right"
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
      (connectionPoints.from === "Bottom" && connectionPoints.to === "Top") ||
      (connectionPoints.from === "Top" && connectionPoints.to === "Bottom") ||
      (connectionPoints.from === "Bottom" &&
        connectionPoints.to === "Bottom") ||
      (connectionPoints.from === "Top" && connectionPoints.to === "Top")
    ) {
      const dir =
        connectionPoints.from === "Top" && connectionPoints.to === "Bottom"
          ? -1
          : 1;
      const clearance =
        Math.min(
          Math.abs(connectionPoints.n2.y - connectionPoints.n1.y) / 2,
          LINE_CLEARANCE
        ) * dir;

      if (clearance === 0) {
        steps.push(
          `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
          `Q ${midX} ${midY + 50}, ${connectionPoints.n2.x} ${connectionPoints.n2.y}`,
          `L ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
        );
      } else {
        steps.push(
          `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
          `L ${connectionPoints.n1.x} ${connectionPoints.n1.y + clearance}`,
          `C ${connectionPoints.n1.x} ${midY}, ${connectionPoints.n2.x} ${midY}, ${connectionPoints.n2.x} ${connectionPoints.n2.y - clearance}`,
          `L ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
        );
      }
    } else if (
      (connectionPoints.from === "Bottom" && connectionPoints.to === "Left") ||
      (connectionPoints.from === "Top" && connectionPoints.to === "Right") ||
      (connectionPoints.from === "Bottom" && connectionPoints.to === "Right") ||
      (connectionPoints.from === "Top" && connectionPoints.to === "Left")
    ) {
      // Maybe adjust.
      if (
        connectionPoints.from === "Bottom" &&
        connectionPoints.to === "Left" &&
        connectionPoints.n1.x > connectionPoints.n2.x - GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x - GRID_SIZE;
      } else if (
        connectionPoints.from === "Bottom" &&
        connectionPoints.to === "Right" &&
        connectionPoints.n1.x < connectionPoints.n2.x + GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x + GRID_SIZE;
      } else if (
        connectionPoints.from === "Top" &&
        connectionPoints.to === "Right" &&
        connectionPoints.n1.x < connectionPoints.n2.x + GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x + GRID_SIZE;
      } else if (
        connectionPoints.from === "Top" &&
        connectionPoints.to === "Left" &&
        connectionPoints.n1.x > connectionPoints.n2.x - GRID_SIZE
      ) {
        connectionPoints.n1.x = connectionPoints.n2.x - GRID_SIZE;
      }

      steps.push(
        `M ${connectionPoints.n1.x} ${connectionPoints.n1.y}`,
        `C ${connectionPoints.n1.x} ${midY}, ${connectionPoints.n1.x} ${connectionPoints.n2.y}, ${connectionPoints.n2.x} ${connectionPoints.n2.y}`
      );
    } else if (
      (connectionPoints.from === "Right" && connectionPoints.to === "Top") ||
      (connectionPoints.from === "Left" && connectionPoints.to === "Top") ||
      (connectionPoints.from === "Left" && connectionPoints.to === "Bottom") ||
      (connectionPoints.from === "Right" && connectionPoints.to === "Bottom")
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
    switch (connectionPoints.to) {
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

  #emitAttachmentPointChange(
    evt: PointerEvent,
    which: "from" | "to",
    attachmentPoint: EdgeAttachmentPoint
  ) {
    evt.stopImmediatePropagation();

    if (which === "from" && this.from === attachmentPoint) {
      attachmentPoint = "Auto";
    }

    if (which === "to" && this.to === attachmentPoint) {
      attachmentPoint = "Auto";
    }

    this.dispatchEvent(
      new GraphEdgeAttachmentMoveEvent(this.edge.raw(), which, attachmentPoint)
    );
  }

  protected renderSelf() {
    if (intersects(this.node1.worldBounds, this.node2.worldBounds, 0)) {
      return nothing;
    }

    const styles: Record<string, string> = {
      transform: toCSSMatrix(this.worldTransform),
    };

    const nodeBoundPoints = this.#getNodeBoundPoints();
    const { n1t, n1r, n1b, n1l, n2t, n2r, n2b, n2l } = nodeBoundPoints;

    const connectionPointRadius = CONNECTION_POINT_RADIUS - 2;
    const connectionPoints = this.#calculateConnectionPoints(nodeBoundPoints);

    const rotation = this.#createRotationFromConnectionPoints(connectionPoints);
    const steps = this.#createStepsFromConnectionPoints(connectionPoints);
    let arrowSize = ARROW_SIZE;
    if (connectionPoints.to === "Top") {
      arrowSize = clamp(
        connectionPoints.n2.y - connectionPoints.n1.y,
        3,
        ARROW_SIZE
      );
    } else if (connectionPoints.to === "Bottom") {
      arrowSize = clamp(
        connectionPoints.n1.y - connectionPoints.n2.y,
        3,
        ARROW_SIZE
      );
    } else if (connectionPoints.to === "Left") {
      arrowSize = clamp(
        connectionPoints.n2.x - connectionPoints.n1.x,
        3,
        ARROW_SIZE
      );
    } else if (connectionPoints.to === "Right") {
      arrowSize = clamp(
        connectionPoints.n1.x - connectionPoints.n2.x,
        3,
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

    if (this.highlighted) {
      switch (this.highlightType) {
        case "user": {
          edgeColor = EDGE_USER;
          break;
        }

        case "model": {
          edgeColor = EDGE_MODEL;
          break;
        }
      }
    }

    let fromEdgePoint: HTMLTemplateResult | symbol = nothing;
    let toEdgePoint: HTMLTemplateResult | symbol = nothing;
    if (this.from !== "Auto") {
      let x = 0;
      let y = 0;
      switch (this.from) {
        case "Top": {
          x = n1t.x;
          y = n1t.y;
          break;
        }
        case "Right": {
          x = n1r.x;
          y = n1r.y;
          break;
        }
        case "Bottom": {
          x = n1b.x;
          y = n1b.y;
          break;
        }
        case "Left": {
          x = n1l.x;
          y = n1l.y;
          break;
        }
      }

      fromEdgePoint = html`${svg`<circle
        cx=${x + CONNECTION_POINT_RADIUS}
        cy=${y + CONNECTION_POINT_RADIUS}
        r=${connectionPointRadius - 2}
        fill="#3399ff" />`}`;
    }

    if (this.to !== "Auto") {
      let x = 0;
      let y = 0;
      switch (this.to) {
        case "Top": {
          x = n2t.x;
          y = n2t.y;
          break;
        }
        case "Right": {
          x = n2r.x;
          y = n2r.y;
          break;
        }
        case "Bottom": {
          x = n2b.x;
          y = n2b.y;
          break;
        }
        case "Left": {
          x = n2l.x;
          y = n2l.y;
          break;
        }
      }

      toEdgePoint = html`${svg`<circle
        cx=${x + CONNECTION_POINT_RADIUS}
        cy=${y + CONNECTION_POINT_RADIUS}
        r=${connectionPointRadius - 2}
        fill="#3399ff" />`}`;
    }

    return html`<section
        id="container"
        class=${classMap({ bounds: this.showBounds })}
        style=${styleMap(styles)}
      >
        ${svg`
          <svg id="edge" ${ref(this.#edgeRef)} version="1.1"
               width=${this.bounds.width} height=${this.bounds.height} viewBox="0 0 ${this.bounds.width} ${this.bounds.height}"
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
        `} ${this.showEdgePointSelectors
          ? svg`<svg } id="point-selectors" version="1.1"
               width=${this.bounds.width + CONNECTION_POINT_RADIUS * 2} height=${this.bounds.height + CONNECTION_POINT_RADIUS * 2}
               xmlns="http://www.w3.org/2000/svg">
                ${this.from !== "Auto" ? fromEdgePoint : nothing}
                ${this.to !== "Auto" ? toEdgePoint : nothing}
                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "from", "Top")} cx=${n1t.x + CONNECTION_POINT_RADIUS} cy=${n1t.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />
                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "from", "Right")} cx=${n1r.x + CONNECTION_POINT_RADIUS} cy=${n1r.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />
                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "from", "Bottom")} cx=${n1b.x + CONNECTION_POINT_RADIUS} cy=${n1b.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />
                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "from", "Left")} cx=${n1l.x + CONNECTION_POINT_RADIUS} cy=${n1l.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />

                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "to", "Top")} cx=${n2t.x + CONNECTION_POINT_RADIUS} cy=${n2t.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />
                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "to", "Right")} cx=${n2r.x + CONNECTION_POINT_RADIUS} cy=${n2r.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />
                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "to", "Bottom")} cx=${n2b.x + CONNECTION_POINT_RADIUS} cy=${n2b.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />
                <circle @pointerdown=${(evt: PointerEvent) => this.#emitAttachmentPointChange(evt, "to", "Left")} cx=${n2l.x + CONNECTION_POINT_RADIUS} cy=${n2l.y + CONNECTION_POINT_RADIUS} r=${connectionPointRadius} stroke="#246db5aa" fill="#ff00ff00" />
          </svg>`
          : nothing}
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
