/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { customElement, property } from "lit/decorators.js";
import { Box } from "./box";
import { css, html, HTMLTemplateResult, nothing, svg } from "lit";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { toCSSMatrix } from "./utils/to-css-matrix";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { intersects } from "./utils/rect-intersection";
import { getGlobalColor } from "../../utils/color";
import { EdgeAttachmentPoint } from "../../types/types";
import { inspectableEdgeToString } from "../../utils/workspace";
import { InspectableAssetEdge, InspectableEdge } from "@google-labs/breadboard";
import {
  GraphEdgeAttachmentMoveEvent,
  NodeBoundsUpdateRequestEvent,
} from "./events/events";
import { clamp } from "./utils/clamp";
import { Entity } from "./entity";
import { calculatePointsOnCubicBezierCurve } from "./utils/cubic-bezier";
import { icons } from "../../styles/icons";

interface Connection {
  n1: DOMPoint;
  n2: DOMPoint;
  from: "Top" | "Right" | "Bottom" | "Left";
  to: "Top" | "Right" | "Bottom" | "Left";
  distance: number;
}

const EDGE_STANDARD = getGlobalColor("--bb-neutral-400");
const EDGE_SELECTED = getGlobalColor("--bb-ui-500");

// Value is no longer on the wire, because it was consumed by the receiving
// component. Constant wires never reach this state.
const EDGE_CONSUMED = getGlobalColor("--bb-input-600");

// Value is on the wire, but hasn't been consumed by receiving component yet.
const EDGE_STORED = getGlobalColor("--bb-human-600");

// Value is on the wire, but hasn't been consumed by receiving component yet.
const EDGE_USER = getGlobalColor("--bb-joiner-600");
const EDGE_MODEL = getGlobalColor("--bb-generative-600");

const EDGE_CLEARANCE = 0;
const HALF_HEADER_HEIGHT = 18;
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
    icons,
    Box.styles,
    css`
      :host {
        z-index: 1;
      }

      :host([showbounds]) #bounds {
        outline: 2px solid blue;
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
        cursor: pointer;
      }

      #point-selectors {
        position: absolute;
        top: -8px;
        left: -8px;
        z-index: 4;
      }

      .g-icon {
        font-size: 12px;
        font-variation-settings:
          "FILL" 0,
          "GRAD" 0,
          "ROND" 100,
          "wght" 500;
        color: var(--bb-neutral-0);
      }
    `,
  ];

  #edgeRef: Ref<SVGSVGElement> = createRef();
  #edgeHitAreaRef: Ref<SVGPathElement> = createRef();

  @property()
  accessor from: EdgeAttachmentPoint = "Auto";

  @property()
  accessor to: EdgeAttachmentPoint = "Auto";

  @property()
  accessor carriesList = false;

  constructor(
    public readonly node1: Entity,
    public readonly node2: Entity,
    public readonly edge: InspectableEdge | InspectableAssetEdge,
    public readonly edgeType: "node" | "asset"
  ) {
    super();

    this.cullable = true;
  }

  #isInspectableEdge(
    edge: InspectableEdge | InspectableAssetEdge
  ): edge is InspectableEdge {
    return `raw` in (edge as InspectableEdge);
  }

  get edgeId() {
    if (this.#isInspectableEdge(this.edge)) {
      return inspectableEdgeToString(this.edge);
    }

    return this.edge.assetPath;
  }

  set edgeId(_edgeId: string) {
    throw new Error("Unable to set edge ID - read only");
  }

  calculateLocalBounds(): DOMRect {
    const nodeBoundPoints = this.#getNodeBoundPoints();
    const connectionPoints = this.#calculateConnectionPoints(nodeBoundPoints);
    const steps = this.#createStepsFromConnectionPoints(connectionPoints);
    const points = calculatePointsOnCubicBezierCurve(
      steps.cpA.x,
      steps.cpA.y,
      steps.cp1.x,
      steps.cp1.y,
      steps.cp2.x,
      steps.cp2.y,
      steps.cpB.x,
      steps.cpB.y,
      0,
      1,
      0.1
    );

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      minX = Math.min(minX, point.x - 5);
      minY = Math.min(minY, point.y - 5);
      maxX = Math.max(maxX, point.x + 5);
      maxY = Math.max(maxY, point.y + 5);
    }

    const pointBounds = new DOMRect(minX, minY, maxX - minX, maxY - minY);

    const top = Math.min(
      this.node1.transform.f - EDGE_CLEARANCE,
      this.node2.transform.f - EDGE_CLEARANCE,
      pointBounds.y + this.transform.f
    );
    const bottom = Math.max(
      this.node1.transform.f + this.node1.bounds.height + EDGE_CLEARANCE,
      this.node2.transform.f + this.node2.bounds.height + EDGE_CLEARANCE,
      pointBounds.y + pointBounds.height + this.transform.f
    );

    const left = Math.min(
      this.node1.transform.e - EDGE_CLEARANCE,
      this.node2.transform.e - EDGE_CLEARANCE,
      pointBounds.x + this.transform.e
    );
    const right = Math.max(
      this.node1.transform.e + this.node1.bounds.width + EDGE_CLEARANCE,
      this.node2.transform.e + this.node2.bounds.width + EDGE_CLEARANCE,
      pointBounds.x + this.transform.e + pointBounds.width
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
    const candidates: Connection = {
      n1: new DOMPoint(),
      n2: new DOMPoint(),
      from: "Top",
      to: "Top",
      distance: Number.POSITIVE_INFINITY,
    };

    const calculateShortestPath = (
      n1: DOMPoint,
      n2: DOMPoint,
      from: "Top" | "Right" | "Bottom" | "Left",
      to: "Top" | "Right" | "Bottom" | "Left"
    ) => {
      const dist = this.#distanceSq(n1, n2);
      if (dist > candidates.distance) {
        return;
      }

      if (dist === candidates.distance) {
        return;
      }

      candidates.n1.x = n1.x;
      candidates.n1.y = n1.y;
      candidates.n2.x = n2.x;
      candidates.n2.y = n2.y;
      candidates.from = from;
      candidates.to = to;
      candidates.distance = dist;
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
    if (candidates.to === "Left") candidates.n2.x -= 4;
    if (candidates.to === "Right") candidates.n2.x += 4;
    if (candidates.to === "Top") candidates.n2.y -= 4;
    if (candidates.to === "Bottom") candidates.n2.y += 4;

    // We were working with squared distances so adjust the final distance.
    candidates.distance = Math.sqrt(candidates.distance);

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
    const n1adjust = new DOMPoint();
    const n2adjust = new DOMPoint();
    const c1adjust = new DOMPoint();
    const c2adjust = new DOMPoint();

    const dist = Math.sqrt(
      this.#distanceSq(connectionPoints.n1, connectionPoints.n2)
    );
    const nDist = clamp(dist * 0.1, 0, 10);
    const cDist = clamp(dist * 0.5, 25, 100);

    if (connectionPoints.from === "Top") n1adjust.y = -nDist;
    if (connectionPoints.from === "Bottom") n1adjust.y = nDist;
    if (connectionPoints.from === "Left") n1adjust.x = -nDist;
    if (connectionPoints.from === "Right") n1adjust.x = nDist;

    if (connectionPoints.from === "Top") c1adjust.y = -cDist;
    if (connectionPoints.from === "Bottom") c1adjust.y = cDist;
    if (connectionPoints.from === "Left") c1adjust.x = -cDist;
    if (connectionPoints.from === "Right") c1adjust.x = cDist;

    if (connectionPoints.to === "Top") n2adjust.y = -nDist;
    if (connectionPoints.to === "Bottom") n2adjust.y = nDist;
    if (connectionPoints.to === "Left") n2adjust.x = -nDist;
    if (connectionPoints.to === "Right") n2adjust.x = nDist;

    if (connectionPoints.to === "Top") c2adjust.y = -cDist;
    if (connectionPoints.to === "Bottom") c2adjust.y = cDist;
    if (connectionPoints.to === "Left") c2adjust.x = -cDist;
    if (connectionPoints.to === "Right") c2adjust.x = cDist;

    return {
      start: new DOMPoint(connectionPoints.n1.x, connectionPoints.n1.y),
      end: new DOMPoint(connectionPoints.n2.x, connectionPoints.n2.y),
      cpA: new DOMPoint(
        connectionPoints.n1.x + n1adjust.x,
        connectionPoints.n1.y + n1adjust.y
      ),
      cpB: new DOMPoint(
        connectionPoints.n2.x + n2adjust.x,
        connectionPoints.n2.y + n2adjust.y
      ),
      cp1: new DOMPoint(
        connectionPoints.n1.x + c1adjust.x,
        connectionPoints.n1.y + c1adjust.y
      ),
      cp2: new DOMPoint(
        connectionPoints.n2.x + c2adjust.x,
        connectionPoints.n2.y + c2adjust.y
      ),
    };
  }

  #createSVGStepsFromConnectionPoints(connectionPoints: Connection) {
    const steps = this.#createStepsFromConnectionPoints(connectionPoints);
    return [
      `M ${steps.start.x} ${steps.start.y}`,
      `L ${steps.cpA.x} ${steps.cpA.y}`,
      `C ${steps.cp1.x} ${steps.cp1.y}, ${steps.cp2.x} ${steps.cp2.y}, ${steps.cpB.x} ${steps.cpB.y}`,
      `L ${steps.end.x} ${steps.end.y}`,
    ];
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

    if (!this.#isInspectableEdge(this.edge)) {
      return;
    }

    this.dispatchEvent(
      new GraphEdgeAttachmentMoveEvent(this.edge.raw(), which, attachmentPoint)
    );
  }

  protected renderSelf() {
    const styles: Record<string, string> = {
      transform: toCSSMatrix(this.worldTransform),
    };

    const nodeBoundPoints = this.#getNodeBoundPoints();
    const { n1t, n1r, n1b, n1l, n2t, n2r, n2b, n2l } = nodeBoundPoints;

    const connectionPointRadius = CONNECTION_POINT_RADIUS - 2;
    const connectionPoints = this.#calculateConnectionPoints(nodeBoundPoints);
    const midX =
      connectionPoints.n1.x +
      (connectionPoints.n2.x - connectionPoints.n1.x) * 0.5;
    const midY =
      connectionPoints.n1.y +
      (connectionPoints.n2.y - connectionPoints.n1.y) * 0.5;

    if (this.#distanceSq(connectionPoints.n1, connectionPoints.n2) < 400) {
      return nothing;
    }

    const rotation = this.#createRotationFromConnectionPoints(connectionPoints);
    const steps = this.#createSVGStepsFromConnectionPoints(connectionPoints);
    const arrowSize = ARROW_SIZE;

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

    let dashArray = ``;
    if (this.edgeType === "asset") {
      dashArray = `4 4`;
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
                  stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray=${dashArray} />

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

                ${
                  this.carriesList
                    ? svg`<circle cx=${midX} cy=${midY} r="7" fill=${this.selected ? EDGE_SELECTED : edgeColor} />
                  <foreignObject x=${midX - 6} y=${midY - 9} width="14" height="14">
                    <span xmlns="http://www.w3.org/1999/xhtml" class="g-icon">data_array</span>
                  </foreignObject>`
                    : nothing
                }
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

  protected firstUpdated(): void {
    if (this.#edgeRef.value) {
      this.dispatchEvent(new NodeBoundsUpdateRequestEvent());
    }
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
