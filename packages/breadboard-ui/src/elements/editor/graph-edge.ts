/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableEdge, InspectableEdgeType } from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import { GraphNode } from "./graph-node.js";

const documentStyles = getComputedStyle(document.documentElement);

function getGlobalColor(name: string, defaultValue = "#333333") {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  return parseInt(value || defaultValue, 16);
}

const edgeColorSelected = getGlobalColor("--bb-nodes-600");
const edgeColorOrdinary = getGlobalColor("--bb-neutral-300");
const edgeColorConstant = getGlobalColor("--bb-output-200");
const edgeColorControl = getGlobalColor("--bb-boards-200");
const edgeColorStar = getGlobalColor("--bb-inputs-200");

const EDGE_HIT_AREA_ALPHA = 0.0001;

export class GraphEdge extends PIXI.Graphics {
  #isDirty = true;
  #edge: InspectableEdge | null = null;
  #overrideColor: number | null = null;
  #loopBackPadding = 30;
  #loopBackCurveRadius = 10;
  #overrideInLocation: PIXI.ObservablePoint<unknown> | null = null;
  #overrideOutLocation: PIXI.ObservablePoint<unknown> | null = null;
  #type: InspectableEdgeType | null = null;
  #selected = false;
  #hitAreaSpacing = 10;
  #hitArea = new PIXI.Graphics();

  constructor(
    public fromNode: GraphNode,
    public toNode: GraphNode,
    public temporary = false
  ) {
    super();

    this.eventMode = "static";
    this.cursor = "pointer";
    this.#hitArea.eventMode = "auto";
    this.#hitArea.cursor = "pointer";
  }

  set edge(edge: InspectableEdge | null) {
    // Since the `edge` is a stable instance, make a copy of the edge to avoid
    // modifying the original.
    this.#edge = edge
      ? {
          from: edge.from,
          to: edge.to,
          in: edge.in,
          out: edge.out,
          type: edge.type,
        }
      : null;
    this.#isDirty = true;
  }

  get selected() {
    return this.#selected;
  }

  set selected(selected: boolean) {
    this.#selected = selected;
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

  set overrideInLocation(
    overrideInLocation: PIXI.ObservablePoint<unknown> | null
  ) {
    if (overrideInLocation === this.#overrideInLocation) {
      return;
    }

    this.#overrideInLocation = overrideInLocation;
    this.#isDirty = true;
  }

  get overrideInLocation() {
    return this.#overrideInLocation;
  }

  set overrideOutLocation(
    overrideOutLocation: PIXI.ObservablePoint<unknown> | null
  ) {
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

  render(renderer: PIXI.Renderer) {
    super.render(renderer);

    if (this.#isDirty) {
      this.clear();
      this.#hitArea.clear();

      this.#draw();
      this.#isDirty = false;
      this.addChild(this.#hitArea);
    }
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

    // Take a copy rather than modifying the original values.
    outLocation = outLocation.clone();
    inLocation = inLocation.clone();

    // Convert to graph-centric values.
    outLocation.x += this.fromNode.position.x;
    outLocation.y += this.fromNode.position.y;

    inLocation.x += this.toNode.position.x;
    inLocation.y += this.toNode.position.y;

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

    if (this.#overrideColor) {
      edgeColor = this.#overrideColor;
    }

    if (this.selected) {
      edgeColor = edgeColorSelected;
    }

    this.lineStyle(2, edgeColor);
    this.moveTo(outLocation.x, outLocation.y);

    const midY = Math.round((inLocation.y - outLocation.y) * 0.5);
    const ndx = outLocation.x - inLocation.x;
    const ndy = outLocation.y - inLocation.y;
    const nodeDistance = Math.sqrt(ndx * ndx + ndy * ndy);
    const padding = Math.min(nodeDistance * 0.25, 50);

    // Loopback.
    if (
      this.fromNode === this.toNode &&
      !this.#overrideInLocation &&
      !this.#overrideOutLocation
    ) {
      // Line.
      this.lineTo(
        outLocation.x + this.#loopBackPadding - this.#loopBackCurveRadius,
        outLocation.y
      );
      this.quadraticCurveTo(
        outLocation.x + this.#loopBackPadding,
        outLocation.y,
        outLocation.x + this.#loopBackPadding,
        outLocation.y + this.#loopBackCurveRadius
      );
      this.lineTo(
        outLocation.x + this.#loopBackPadding,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding -
          this.#loopBackCurveRadius
      );
      this.quadraticCurveTo(
        outLocation.x + this.#loopBackPadding,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding,
        outLocation.x + this.#loopBackPadding - this.#loopBackCurveRadius,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding
      );

      this.lineTo(
        inLocation.x - this.#loopBackPadding + this.#loopBackCurveRadius,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding
      );
      this.quadraticCurveTo(
        inLocation.x - this.#loopBackPadding,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding,
        inLocation.x - this.#loopBackPadding,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding -
          this.#loopBackCurveRadius
      );

      this.lineTo(
        inLocation.x - this.#loopBackPadding,
        inLocation.y + this.#loopBackCurveRadius
      );
      this.quadraticCurveTo(
        inLocation.x - this.#loopBackPadding,
        inLocation.y,
        inLocation.x - this.#loopBackPadding + this.#loopBackCurveRadius,
        inLocation.y
      );

      this.lineTo(inLocation.x, inLocation.y);

      // Hit Area.
      this.#hitArea.beginFill(0, EDGE_HIT_AREA_ALPHA);
      this.#hitArea.drawRect(
        outLocation.x,
        outLocation.y - this.#hitAreaSpacing,
        this.#loopBackPadding + this.#hitAreaSpacing,
        this.#hitAreaSpacing * 2
      );

      this.#hitArea.drawRect(
        outLocation.x + this.#loopBackPadding - this.#hitAreaSpacing,
        outLocation.y + this.#hitAreaSpacing,
        this.#hitAreaSpacing * 2,
        this.fromNode.height - outLocation.y + this.#loopBackPadding
      );

      this.#hitArea.drawRect(
        inLocation.x - this.#loopBackPadding - this.#hitAreaSpacing,
        this.fromNode.y +
          this.fromNode.height +
          this.#loopBackPadding -
          this.#hitAreaSpacing,
        outLocation.x +
          this.#loopBackPadding -
          this.#hitAreaSpacing -
          (inLocation.x - this.#loopBackPadding - this.#hitAreaSpacing),
        this.#hitAreaSpacing * 2
      );

      this.#hitArea.drawRect(
        inLocation.x - this.#loopBackPadding - this.#hitAreaSpacing,
        inLocation.y - this.#hitAreaSpacing,
        this.#hitAreaSpacing * 2,
        this.fromNode.height - inLocation.y + this.#loopBackPadding
      );

      this.#hitArea.drawRect(
        inLocation.x - this.#loopBackPadding + this.#hitAreaSpacing,
        inLocation.y - this.#hitAreaSpacing,
        this.#loopBackPadding - this.#hitAreaSpacing,
        this.#hitAreaSpacing * 2
      );
      this.#hitArea.endFill();
      return;
    }

    // All other cases.
    // First calculate the line segments.
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
        inLocation.x - Math.max(padding, (inLocation.x - outLocation.x) * 0.25),
      y: outLocation.y + midY + (inLocation.y - (outLocation.y + midY)) * 0.5,
    };

    // Next calculate the control points.
    const angleA = Math.atan2(midA.y - outLocation.y, midA.x - outLocation.x);
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
    this.moveTo(outLocation.x, outLocation.y);
    if (Math.abs(midA.x - midB.x) > 0.5) {
      this.bezierCurveTo(cpA1.x, cpA1.y, cpA2.x, cpA2.y, midA.x, midA.y);
      this.lineTo(midB.x, midB.y);
      this.bezierCurveTo(
        cpB1.x,
        cpB1.y,
        cpB2.x,
        cpB2.y,
        inLocation.x,
        inLocation.y
      );
    } else {
      this.quadraticCurveTo(pivotA.x, outLocation.y, midA.x, midA.y);
      this.quadraticCurveTo(pivotB.x, inLocation.y, inLocation.x, inLocation.y);
    }

    // Circles at the start & end.
    this.beginFill(edgeColor);
    this.drawCircle(outLocation.x, outLocation.y, 2);
    this.drawCircle(inLocation.x, inLocation.y, 2);
    this.endFill();

    // Hit Area.
    this.#hitArea.beginFill(0, EDGE_HIT_AREA_ALPHA);
    this.#hitArea.moveTo(outLocation.x, outLocation.y - this.#hitAreaSpacing);
    if (Math.abs(midA.x - midB.x) > 0.5) {
      this.#hitArea.bezierCurveTo(
        cpA1.x + this.#hitAreaSpacing,
        cpA1.y,
        cpA2.x + this.#hitAreaSpacing,
        cpA2.y,
        midA.x,
        midA.y + this.#hitAreaSpacing
      );
      this.#hitArea.lineTo(midB.x, midB.y + this.#hitAreaSpacing);
      this.#hitArea.bezierCurveTo(
        cpB1.x + this.#hitAreaSpacing,
        cpB1.y,
        cpB2.x + this.#hitAreaSpacing,
        cpB2.y,
        inLocation.x,
        inLocation.y - this.#hitAreaSpacing
      );
      this.#hitArea.lineTo(inLocation.x, inLocation.y + this.#hitAreaSpacing);
      this.#hitArea.bezierCurveTo(
        cpB2.x - this.#hitAreaSpacing,
        cpB2.y,
        cpB1.x - this.#hitAreaSpacing,
        cpB1.y,
        midB.x,
        midB.y - this.#hitAreaSpacing
      );
      this.#hitArea.lineTo(midA.x, midA.y - this.#hitAreaSpacing);
      this.#hitArea.bezierCurveTo(
        cpA2.x - this.#hitAreaSpacing,
        cpA2.y,
        cpA1.x - this.#hitAreaSpacing,
        cpA1.y,
        outLocation.x,
        outLocation.y + this.#hitAreaSpacing
      );
    } else {
      const angle = Math.atan2(
        inLocation.y - outLocation.y,
        inLocation.x - outLocation.x
      );
      const xDist = Math.sin(angle) * this.#hitAreaSpacing;
      const yDist = Math.cos(angle) * this.#hitAreaSpacing;

      this.#hitArea.quadraticCurveTo(
        pivotA.x + xDist,
        outLocation.y - this.#hitAreaSpacing,
        midA.x + xDist,
        midA.y - yDist
      );
      this.#hitArea.quadraticCurveTo(
        pivotB.x + xDist,
        inLocation.y - this.#hitAreaSpacing,
        inLocation.x,
        inLocation.y - this.#hitAreaSpacing
      );
      this.#hitArea.lineTo(inLocation.x, inLocation.y + this.#hitAreaSpacing);
      this.#hitArea.quadraticCurveTo(
        pivotB.x - xDist,
        inLocation.y + this.#hitAreaSpacing,
        midA.x - xDist,
        midA.y + yDist
      );
      this.#hitArea.quadraticCurveTo(
        pivotA.x - xDist,
        outLocation.y + this.#hitAreaSpacing,
        outLocation.x,
        outLocation.y + this.#hitAreaSpacing
      );
    }
    this.#hitArea.endFill();
  }
}
