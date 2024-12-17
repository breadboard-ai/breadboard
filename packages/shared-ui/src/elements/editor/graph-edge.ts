/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableEdgeType, Schema } from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import { GraphNode } from "./graph-node.js";
import { getGlobalColor } from "./utils.js";
import {
  EdgeData,
  TopGraphEdgeInfo,
  cloneEdgeData,
} from "../../types/types.js";
import { GraphAssets } from "./graph-assets.js";
import { GRAPH_OPERATIONS } from "./types.js";
import { segmentIntersection } from "@pixi/math-extras";

// Value is on the wire, but hasn't been consumed by receiving component yet.
const edgeColorValueStored = getGlobalColor("--bb-human-600");
// Value is no longer on the wire, because it was consumed by the receiving
// component. Constant wires never reach this state.
const edgeColorValueConsumed = getGlobalColor("--bb-input-600");
const edgeColorSelected = getGlobalColor("--bb-ui-600");
const edgeColorOrdinary = getGlobalColor("--bb-neutral-400");
const edgeColorConstant = getGlobalColor("--bb-ui-200");
const edgeColorControl = getGlobalColor("--bb-boards-200");
const edgeColorStar = getGlobalColor("--bb-inputs-200");
const edgeColorInvalid = getGlobalColor("--bb-warning-500");

const ICON_SCALE = 0.33;

/**
 * Calculates an [x,y] pair of points from start to end via the control point.
 * Per the math, this is defined as:
 *
 * (1-t)² * start + 2(1 - t) * t * cp + t² * end.
 *
 * @see https://en.wikipedia.org/wiki/B%C3%A9zier_curve
 */
function calculatePointsOnQuadraticBezierCurve(
  startX: number,
  startY: number,
  cpX: number,
  cpY: number,
  endX: number,
  endY: number,
  from: number,
  to: number,
  step: number
) {
  if (from > to || from < 0 || from > 1 || to < 0 || to > 1) {
    throw new Error(
      "from must be less than to, and both must be between 0 and 1"
    );
  }

  const points: number[] = [];
  for (let t = from; t <= to; t += step) {
    points.push(
      (1 - t) ** 2 * startX + 2 * (1 - t) * t * cpX + t ** 2 * endX,
      (1 - t) ** 2 * startY + 2 * (1 - t) * t * cpY + t ** 2 * endY
    );
  }
  return points;
}

export class GraphEdge extends PIXI.Container {
  #isDirty = true;
  #edge: EdgeData | null = null;
  #overrideColor: number | null = null;
  #edgePaddingRight = 24;
  #loopBackPadding = 30;
  #loopBackCurveRadius = 20;
  #overrideInLocation: PIXI.ObservablePoint | null = null;
  #overrideOutLocation: PIXI.ObservablePoint | null = null;
  #type: InspectableEdgeType | null = null;
  #selected = false;
  #invalid = false;
  #edgeGraphic = new PIXI.Graphics();
  #valueSelector = new PIXI.Graphics();
  #valueSprite: PIXI.Sprite | null;
  #editSprite: PIXI.Sprite | null;
  #schema: Schema | null = null;
  #value: TopGraphEdgeInfo[] | null = null;
  #hitAreaSpacing = 6;

  #debugHitArea = false;
  #debugHitAreaGraphic = new PIXI.Graphics();

  readOnly = false;

  constructor(
    public fromNode: GraphNode,
    public toNode: GraphNode,
    public temporary = false
  ) {
    super();

    this.eventMode = "static";
    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }
      this.#edgeGraphic.clear();
      this.#draw();
      this.#isDirty = false;
    };

    this.on("destroyed", () => {
      // Prevent future renderings.
      this.#isDirty = false;

      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });

    this.#edgeGraphic.addEventListener("pointerover", () => {
      if (this.readOnly) {
        return;
      }

      this.#edgeGraphic.cursor = "pointer";
    });

    this.#valueSelector.addEventListener(
      "pointerdown",
      (evt: PIXI.FederatedPointerEvent) => {
        this.emit(
          GRAPH_OPERATIONS.GRAPH_EDGE_VALUE_SELECTED,
          this.value,
          this.schema,
          this.edge,
          evt.x,
          evt.y
        );
      }
    );

    const valueTexture = GraphAssets.instance().get("value");
    const editTexture = GraphAssets.instance().get("edit");
    this.#valueSprite = valueTexture ? new PIXI.Sprite(valueTexture) : null;
    this.#editSprite = editTexture ? new PIXI.Sprite(editTexture) : null;

    this.#edgeGraphic.label = "GraphEdge";
    this.#edgeGraphic.eventMode = "static";

    this.addChild(this.#edgeGraphic);
    this.addChild(this.#valueSelector);

    if (this.#valueSprite) {
      this.addChild(this.#valueSprite);
      this.#valueSprite.scale.x = ICON_SCALE;
      this.#valueSprite.scale.y = ICON_SCALE;
      this.#valueSprite.eventMode = "none";
      this.#valueSprite.visible = false;
    }

    if (this.#editSprite) {
      this.addChild(this.#editSprite);
      this.#editSprite.scale.x = ICON_SCALE;
      this.#editSprite.scale.y = ICON_SCALE;
      this.#editSprite.eventMode = "none";
      this.#editSprite.visible = false;
    }

    if (this.#debugHitArea) {
      this.addChild(this.#debugHitAreaGraphic);
      this.#debugHitAreaGraphic.eventMode = "none";
    }
  }

  set edge(edge: EdgeData | null) {
    // Since the `edge` is a stable instance, make a copy of the edge to avoid
    // modifying the original.
    this.#edge = cloneEdgeData(edge);
    this.#isDirty = true;
  }

  get selected() {
    return this.#selected;
  }

  set selected(selected: boolean) {
    this.#selected = selected;
    this.#isDirty = true;
  }

  get value() {
    return this.#value;
  }

  set value(value: TopGraphEdgeInfo[] | null) {
    this.#value = value;
    this.#isDirty = true;
  }

  get schema() {
    return this.#schema;
  }

  set schema(schema: Schema | null) {
    this.#schema = schema;
    this.#isDirty = true;
  }

  get invalid() {
    return this.#invalid;
  }

  set invalid(invalid: boolean) {
    this.#invalid = invalid;
    this.#isDirty = true;
  }

  get edge() {
    return this.#edge;
  }

  set overrideColor(overrideColor: number | null) {
    if (overrideColor === this.#overrideColor) {
      return;
    }

    this.#overrideColor = overrideColor;
    this.#isDirty = true;
  }

  get overrideColor() {
    return this.#overrideColor;
  }

  set overrideInLocation(overrideInLocation: PIXI.ObservablePoint | null) {
    if (overrideInLocation === this.#overrideInLocation) {
      return;
    }

    this.#overrideInLocation = overrideInLocation;
    this.#isDirty = true;
  }

  get overrideInLocation() {
    return this.#overrideInLocation;
  }

  set overrideOutLocation(overrideOutLocation: PIXI.ObservablePoint | null) {
    if (overrideOutLocation === this.#overrideOutLocation) {
      return;
    }

    this.#overrideOutLocation = overrideOutLocation;
    this.#isDirty = true;
  }

  get overrideOutLocation() {
    return this.#overrideOutLocation;
  }

  set type(type: InspectableEdgeType | null) {
    if (type === this.#type) {
      return;
    }

    this.#type = type;
    this.#isDirty = true;
  }

  get type() {
    return this.#type;
  }

  get hitArea(): PIXI.Polygon | null {
    if (!this.#edgeGraphic.hitArea) {
      return null;
    }
    if (this.#edgeGraphic.hitArea instanceof PIXI.Polygon) {
      return this.#edgeGraphic.hitArea;
    }
    console.warn("Found edge that does not have a polygon as its hit area.");
    return null;
  }

  forceRedraw() {
    this.#isDirty = true;
  }

  #draw() {
    if (!this.#edge) {
      return;
    }

    let inLocation = this.toNode.inPortLocation(this.#edge.in);
    let outLocation = this.fromNode.outPortLocation(this.#edge.out);

    if (this.#overrideInLocation) {
      inLocation = this.#overrideInLocation;
    }

    if (this.#overrideOutLocation) {
      outLocation = this.#overrideOutLocation;
    }

    if (!(outLocation && inLocation)) {
      return;
    }

    if (!this.fromNode?.position || !this.toNode?.position) {
      // Occasionally, we might be drawing an edge between nodes that have
      // been destroyed. In this case, we should not attempt to draw the edge.
      return;
    }

    // Take a copy rather than modifying the original values.
    outLocation = outLocation.clone();
    inLocation = inLocation.clone();

    // Convert to graph-centric values.
    outLocation.x += this.fromNode.position.x + this.#edgePaddingRight;
    outLocation.y += this.fromNode.position.y;

    inLocation.x += this.toNode.position.x;
    inLocation.y += this.toNode.position.y;

    let edgeWidth = 1;
    let edgeColor = edgeColorOrdinary;
    switch (this.#type) {
      case "control": {
        edgeColor = edgeColorControl;
        break;
      }

      case "constant": {
        edgeColor = edgeColorConstant;
        break;
      }

      case "star": {
        edgeColor = edgeColorStar;
        break;
      }
    }

    if (this.invalid) {
      edgeColor = edgeColorInvalid;
    }

    if (this.#overrideColor) {
      edgeColor = this.#overrideColor;
    }

    if (this.value && this.value.length > 0) {
      if (this.value.at(-1)?.status === "stored") {
        edgeColor = edgeColorValueStored;
      } else {
        edgeColor = edgeColorValueConsumed;
      }
      edgeWidth = 2;
    }

    if (this.selected) {
      edgeColor = edgeColorSelected;
    }

    this.#valueSelector.clear();
    this.#valueSelector.beginPath();
    this.#valueSelector.circle(0, 0, 10);
    this.#valueSelector.closePath();
    this.#valueSelector.fill({ color: edgeColor });
    this.#valueSelector.eventMode = "static";
    this.#valueSelector.cursor = "pointer";
    this.#valueSelector.visible = false;

    this.#edgeGraphic.setStrokeStyle({ width: edgeWidth, color: edgeColor });

    const midY = Math.round((inLocation.y - outLocation.y) * 0.5);
    const ndx = outLocation.x - inLocation.x;
    const ndy = outLocation.y - inLocation.y;
    const nodeDistance = Math.sqrt(ndx * ndx + ndy * ndy);
    const padding = Math.min(nodeDistance * 0.18, 65);

    let hitArea: PIXI.Polygon;

    // Loopback.
    if (
      this.fromNode === this.toNode &&
      !this.#overrideInLocation &&
      !this.#overrideOutLocation
    ) {
      // Line.
      this.#edgeGraphic.beginPath();
      this.#edgeGraphic.moveTo(
        outLocation.x - this.#edgePaddingRight,
        outLocation.y
      );
      this.#edgeGraphic.lineTo(outLocation.x, outLocation.y);
      this.#edgeGraphic.lineTo(
        outLocation.x + this.#loopBackPadding - this.#loopBackCurveRadius,
        outLocation.y
      );
      this.#edgeGraphic.quadraticCurveTo(
        outLocation.x + this.#loopBackPadding,
        outLocation.y,
        outLocation.x + this.#loopBackPadding,
        outLocation.y + this.#loopBackCurveRadius
      );
      this.#edgeGraphic.lineTo(
        outLocation.x + this.#loopBackPadding,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding -
          this.#loopBackCurveRadius
      );
      this.#edgeGraphic.quadraticCurveTo(
        outLocation.x + this.#loopBackPadding,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding,
        outLocation.x + this.#loopBackPadding - this.#loopBackCurveRadius,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding
      );

      this.#edgeGraphic.lineTo(
        inLocation.x - this.#loopBackPadding + this.#loopBackCurveRadius,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding
      );
      this.#edgeGraphic.quadraticCurveTo(
        inLocation.x - this.#loopBackPadding,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding,
        inLocation.x - this.#loopBackPadding,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding -
          this.#loopBackCurveRadius
      );

      this.#edgeGraphic.lineTo(
        inLocation.x - this.#loopBackPadding,
        inLocation.y + this.#loopBackCurveRadius
      );
      this.#edgeGraphic.quadraticCurveTo(
        inLocation.x - this.#loopBackPadding,
        inLocation.y,
        inLocation.x - this.#loopBackPadding + this.#loopBackCurveRadius,
        inLocation.y
      );

      this.#edgeGraphic.lineTo(inLocation.x, inLocation.y);
      this.#edgeGraphic.stroke();
      this.#edgeGraphic.closePath();

      // Hit Area.
      hitArea = new PIXI.Polygon([
        outLocation.x - this.#edgePaddingRight,
        outLocation.y - this.#hitAreaSpacing,

        outLocation.x,
        outLocation.y - this.#hitAreaSpacing,

        outLocation.x + this.#loopBackPadding + this.#hitAreaSpacing,
        outLocation.y - this.#hitAreaSpacing,

        outLocation.x + this.#loopBackPadding + this.#hitAreaSpacing,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding +
          this.#hitAreaSpacing,

        inLocation.x - this.#loopBackPadding - this.#hitAreaSpacing,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding +
          this.#hitAreaSpacing,

        inLocation.x - this.#loopBackPadding - this.#hitAreaSpacing,
        inLocation.y - this.#hitAreaSpacing,

        inLocation.x,
        inLocation.y - this.#hitAreaSpacing,

        inLocation.x,
        inLocation.y + this.#hitAreaSpacing,

        inLocation.x - this.#loopBackPadding + this.#hitAreaSpacing,
        inLocation.y + this.#hitAreaSpacing,

        inLocation.x - this.#loopBackPadding + this.#hitAreaSpacing,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding -
          this.#hitAreaSpacing,

        outLocation.x + this.#loopBackPadding - this.#hitAreaSpacing,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding -
          this.#hitAreaSpacing,

        outLocation.x + this.#loopBackPadding - this.#hitAreaSpacing,
        outLocation.y + this.#hitAreaSpacing,

        outLocation.x,
        outLocation.y + this.#hitAreaSpacing,

        outLocation.x - this.#edgePaddingRight,
        outLocation.y + this.#hitAreaSpacing,
      ]);
    } else {
      // Control points.
      const pivotA = {
        x:
          outLocation.x +
          Math.max(padding, (inLocation.x - outLocation.x) * 0.25),
        y: outLocation.y + midY * 0.5,
      };

      const midA = {
        x: Math.max(
          outLocation.x,
          outLocation.x + (inLocation.x - outLocation.x) * 0.5
        ),
        y: outLocation.y + midY,
      };

      const midB = {
        x: Math.min(
          inLocation.x,
          inLocation.x - (inLocation.x - outLocation.x) * 0.5
        ),
        y: outLocation.y + midY,
      };

      const pivotB = {
        x:
          inLocation.x -
          Math.max(padding, (inLocation.x - outLocation.x) * 0.25),
        y: outLocation.y + midY + (inLocation.y - (outLocation.y + midY)) * 0.5,
      };

      // Standard curve.
      if (Math.abs(midA.x - midB.x) < 0.5) {
        // Line.
        const angleA = Math.atan2(
          midA.y - outLocation.y,
          midA.x - outLocation.x
        );
        const angleB = angleA + Math.PI;
        const dx = Math.abs(pivotA.x - outLocation.x);
        const dy = Math.abs(pivotA.y - outLocation.y);
        const distance = Math.min(dy, Math.sqrt(dx * dx + dy * dy));

        const cpA1 = {
          x: pivotA.x - Math.cos(angleA) * distance,
          y: pivotA.y - Math.sin(angleA) * distance,
        };

        const cpA2 = {
          x: pivotA.x + Math.cos(angleA) * distance,
          y: pivotA.y + Math.sin(angleA) * distance,
        };

        const cpB1 = {
          x: pivotB.x + Math.cos(angleB) * distance,
          y: pivotB.y + Math.sin(angleB) * distance,
        };

        const cpB2 = {
          x: pivotB.x - Math.cos(angleB) * distance,
          y: pivotB.y - Math.sin(angleB) * distance,
        };

        // Lines.
        this.#edgeGraphic.beginPath();
        this.#edgeGraphic.moveTo(
          outLocation.x - this.#edgePaddingRight,
          outLocation.y
        );
        this.#edgeGraphic.lineTo(outLocation.x, outLocation.y);
        if (Math.abs(midA.x - midB.x) > 0.5) {
          this.#edgeGraphic.bezierCurveTo(
            cpA1.x,
            cpA1.y,
            cpA2.x,
            cpA2.y,
            midA.x,
            midA.y
          );
          this.#edgeGraphic.lineTo(midB.x, midB.y);
          this.#edgeGraphic.bezierCurveTo(
            cpB1.x,
            cpB1.y,
            cpB2.x,
            cpB2.y,
            inLocation.x,
            inLocation.y
          );
        } else {
          this.#edgeGraphic.quadraticCurveTo(
            pivotA.x,
            outLocation.y,
            midA.x,
            midA.y
          );
          this.#edgeGraphic.quadraticCurveTo(
            pivotB.x,
            inLocation.y,
            inLocation.x,
            inLocation.y
          );
        }
        this.#edgeGraphic.stroke();
        this.#edgeGraphic.closePath();

        // Hit Area.
        const angle = Math.atan2(
          inLocation.y - outLocation.y,
          inLocation.x - outLocation.x
        );
        const xDist = Math.sin(angle) * this.#hitAreaSpacing;
        const yDist = Math.cos(angle) * this.#hitAreaSpacing;

        hitArea = new PIXI.Polygon([
          outLocation.x - this.#edgePaddingRight,
          outLocation.y - this.#hitAreaSpacing,

          outLocation.x,
          outLocation.y - this.#hitAreaSpacing,

          ...calculatePointsOnQuadraticBezierCurve(
            // Start
            outLocation.x,
            outLocation.y - this.#hitAreaSpacing,

            // Control
            pivotA.x + xDist,
            outLocation.y - this.#hitAreaSpacing,

            // End
            midA.x + xDist,
            midA.y - yDist,

            0.2,
            0.8,
            0.1
          ),

          ...calculatePointsOnQuadraticBezierCurve(
            // Start
            midA.x + xDist,
            midA.y - yDist,

            // Control
            pivotB.x + xDist,
            inLocation.y - this.#hitAreaSpacing,

            // End
            inLocation.x,
            inLocation.y - this.#hitAreaSpacing,

            0.2,
            0.8,
            0.1
          ),

          inLocation.x,
          inLocation.y - this.#hitAreaSpacing,

          inLocation.x,
          inLocation.y + this.#hitAreaSpacing,

          ...calculatePointsOnQuadraticBezierCurve(
            // Start
            inLocation.x,
            inLocation.y + this.#hitAreaSpacing,

            // Control
            pivotB.x - xDist,
            inLocation.y + this.#hitAreaSpacing,

            // End
            midA.x - xDist,
            midA.y + yDist,

            0.2,
            0.8,
            0.1
          ),

          ...calculatePointsOnQuadraticBezierCurve(
            // Start
            midA.x - xDist,
            midA.y + yDist,

            // Control
            pivotA.x - xDist,
            outLocation.y + this.#hitAreaSpacing,

            // End
            outLocation.x,
            outLocation.y + this.#hitAreaSpacing,

            0.2,
            0.8,
            0.1
          ),

          outLocation.x,
          outLocation.y + this.#hitAreaSpacing,

          outLocation.x - this.#edgePaddingRight,
          outLocation.y + this.#hitAreaSpacing,
        ]);
      } else {
        // S-curve Line.
        const startPaddingRight = 1.5 * this.#edgePaddingRight;
        let curveRadius = Math.min(
          this.#loopBackCurveRadius,
          Math.abs(outLocation.y - inLocation.y) * 0.25
        );
        if (inLocation.y < outLocation.y) {
          curveRadius *= -1;
        }

        this.#edgeGraphic.beginPath();

        this.#edgeGraphic.moveTo(
          outLocation.x - this.#edgePaddingRight,
          outLocation.y
        );
        this.#edgeGraphic.lineTo(
          outLocation.x + startPaddingRight - this.#loopBackCurveRadius,
          outLocation.y
        );

        this.#edgeGraphic.quadraticCurveTo(
          outLocation.x + startPaddingRight,
          outLocation.y,
          outLocation.x + startPaddingRight,
          outLocation.y + curveRadius
        );

        this.#edgeGraphic.lineTo(
          outLocation.x + startPaddingRight,
          midA.y - curveRadius
        );
        this.#edgeGraphic.quadraticCurveTo(
          outLocation.x + startPaddingRight,
          midA.y,
          outLocation.x + startPaddingRight - this.#loopBackCurveRadius,
          midA.y
        );

        this.#edgeGraphic.lineTo(
          inLocation.x - this.#loopBackPadding + this.#loopBackCurveRadius,
          midB.y
        );

        this.#edgeGraphic.quadraticCurveTo(
          inLocation.x - this.#loopBackPadding,
          midB.y,
          inLocation.x - this.#loopBackPadding,
          midB.y + curveRadius
        );

        this.#edgeGraphic.lineTo(
          inLocation.x - this.#loopBackPadding,
          inLocation.y - curveRadius
        );

        this.#edgeGraphic.quadraticCurveTo(
          inLocation.x - this.#loopBackPadding,
          inLocation.y,
          inLocation.x - this.#loopBackPadding + this.#loopBackCurveRadius,
          inLocation.y
        );

        this.#edgeGraphic.lineTo(inLocation.x, inLocation.y);

        this.#edgeGraphic.stroke();
        this.#edgeGraphic.closePath();

        // Hit Area.
        hitArea = new PIXI.Polygon([
          outLocation.x - this.#edgePaddingRight,
          outLocation.y - this.#hitAreaSpacing,

          outLocation.x + 1.5 * this.#edgePaddingRight + this.#hitAreaSpacing,
          outLocation.y - this.#hitAreaSpacing,

          outLocation.x + 1.5 * this.#edgePaddingRight + this.#hitAreaSpacing,
          midA.y + this.#hitAreaSpacing,

          inLocation.x - this.#loopBackPadding + this.#hitAreaSpacing,
          midA.y + this.#hitAreaSpacing,

          inLocation.x - this.#loopBackPadding + this.#hitAreaSpacing,
          inLocation.y - this.#hitAreaSpacing,

          inLocation.x,
          inLocation.y - this.#hitAreaSpacing,

          inLocation.x,
          inLocation.y + this.#hitAreaSpacing,

          inLocation.x - this.#loopBackPadding - this.#hitAreaSpacing,
          inLocation.y + this.#hitAreaSpacing,

          inLocation.x - this.#loopBackPadding - this.#hitAreaSpacing,
          midB.y - this.#hitAreaSpacing,

          outLocation.x + 1.5 * this.#edgePaddingRight - this.#hitAreaSpacing,
          midB.y - this.#hitAreaSpacing,

          outLocation.x + 1.5 * this.#edgePaddingRight - this.#hitAreaSpacing,
          outLocation.y + this.#hitAreaSpacing,

          outLocation.x - this.#edgePaddingRight,
          outLocation.y + this.#hitAreaSpacing,
        ]);
      }
    }

    this.#edgeGraphic.hitArea = hitArea;
    if (this.#debugHitArea) {
      this.#debugHitAreaGraphic.clear();
      this.#debugHitAreaGraphic.beginPath();
      this.#debugHitAreaGraphic.poly(hitArea.points);
      this.#debugHitAreaGraphic.closePath();
      this.#debugHitAreaGraphic.fill({ color: 0xff00ff, alpha: 0.1 });
      this.addChild(this.#debugHitAreaGraphic);
    }

    const x = outLocation.x - 4;
    const y = outLocation.y;

    this.#valueSelector.visible = true;
    this.#valueSelector.x = x;
    this.#valueSelector.y = y;

    if (this.#valueSprite) {
      this.#valueSprite.x = x - 8;
      this.#valueSprite.y = y - 8;
      this.#valueSprite.visible = this.value !== null && this.value.length > 0;
    }

    if (this.#editSprite) {
      this.#editSprite.x = x - 8;
      this.#editSprite.y = y - 8;
      this.#editSprite.visible = this.value === null || this.value.length === 0;
    }
  }

  intersectsRect(rect: PIXI.Rectangle): boolean {
    if (!this.hitArea) return false;

    const rectVerts: Array<PIXI.Point> = rectangleVertices(rect);
    const rectEdges: Array<[PIXI.Point, PIXI.Point]> = [];
    for (let i = 0; i < 4; i++) {
      rectEdges.push([rectVerts[i], rectVerts[(i + 1) % 4]]);
    }

    // This for-loop intersects the polygon hitbox with the given rectangle.
    // For every vertex, it checks whether the vertex is inside the rectangle
    // and returns true if that is the case.
    // At the same time, we construct the edges of the polygon along the way
    // and intersect them with each edge of the rectangle.
    // This covers, for example, the case of a mostly diagonal polygon where
    // all vertices are outside the rectangle, but the polygon lines
    // go through the rectangle.
    let lastPoint: PIXI.Point | null = null;
    for (const [x, y] of pairsFromList(this.hitArea.points)) {
      const localP = new PIXI.Point(x, y);
      const p = this.toGlobal(localP);
      if (rect.contains(p.x, p.y)) return true;
      if (lastPoint) {
        const polyEdge = [lastPoint, p] as const;
        for (const rectEdge of rectEdges) {
          if (lineIntersect(...polyEdge, ...rectEdge)) return true;
        }
      }
      lastPoint = p;
    }

    // This last loop checks if any corners of the rectangle are inside the
    // polygon. Getting to this code is exceedingly rare, as most cases are
    // handled by the edge intersection above. This code will only run in the
    // case the rectangle is fully inside the polygon.
    for (const p of rectVerts) {
      if (this.hitArea.contains(p.x, p.y)) return true;
    }
    return false;
  }
}

// pixi-math returns the intersection point. The coordinates of that point are
// NaN if the lines are parallel or only intersect outside the extents of the segments.
function lineIntersect(
  p1s: PIXI.Point,
  p1e: PIXI.Point,
  p2s: PIXI.Point,
  p2e: PIXI.Point
): boolean {
  const i = segmentIntersection(p1s, p1e, p2s, p2e);
  if (Number.isNaN(i.x) || Number.isNaN(i.y)) return false;
  return true;
}

// Iterates over a list of numbers and returns pair-wise elements.
function* pairsFromList(list: number[]) {
  for (let i = 0; i < list.length - 1; i += 2) {
    yield [list[i], list[i + 1]];
  }
}

// Returns all corners of a rectangle. Order is important so that you can
// iterate through this list to compute all edges.
function rectangleVertices(r: PIXI.Rectangle) {
  return [
    new PIXI.Point(r.x, r.y),
    new PIXI.Point(r.x + r.width, r.y),
    new PIXI.Point(r.x + r.width, r.y + r.height),
    new PIXI.Point(r.x, r.y + r.height),
  ];
}
