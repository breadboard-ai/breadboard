/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableEdge } from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import { GraphNode } from "./graph-node.js";

export class GraphEdge extends PIXI.Graphics {
  #isDirty = true;
  #edge: InspectableEdge | null = null;
  #edgeColor = 0xaaaaaa;
  #overrideColor: number | null = null;
  #loopBackPadding = 10;
  #overrideInLocation: PIXI.ObservablePoint<unknown> | null = null;
  #overrideOutLocation: PIXI.ObservablePoint<unknown> | null = null;

  constructor(
    public fromNode: GraphNode,
    public toNode: GraphNode,
    public temporary = false
  ) {
    super();
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

  get edge() {
    return this.#edge;
  }

  set overrideColor(overrideColor: number | null) {
    this.#overrideColor = overrideColor;
    this.#isDirty = true;
  }

  get overrideColor() {
    return this.#overrideColor;
  }

  set overrideInLocation(
    overrideInLocation: PIXI.ObservablePoint<unknown> | null
  ) {
    this.#overrideInLocation = overrideInLocation;
    this.#isDirty = true;
  }

  get overrideInLocation() {
    return this.#overrideInLocation;
  }

  set overrideOutLocation(
    overrideOutLocation: PIXI.ObservablePoint<unknown> | null
  ) {
    this.#overrideOutLocation = overrideOutLocation;
    this.#isDirty = true;
  }

  get overrideOutLocation() {
    return this.#overrideOutLocation;
  }

  render(renderer: PIXI.Renderer) {
    super.render(renderer);

    if (this.#isDirty) {
      this.clear();
      this.#draw();
      this.#isDirty = false;
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

    const midY = Math.round((inLocation.y - outLocation.y) * 0.5);
    const color =
      this.#overrideColor ?? this.fromNode.edgeColor ?? this.#edgeColor;

    this.lineStyle(2, color);
    this.moveTo(outLocation.x, outLocation.y);

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
      this.lineTo(outLocation.x + padding, outLocation.y);
      this.lineTo(
        outLocation.x + padding,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding
      );
      this.lineTo(
        inLocation.x - padding,
        this.fromNode.y + this.fromNode.height + this.#loopBackPadding
      );
      this.lineTo(inLocation.x - padding, inLocation.y);
      this.lineTo(inLocation.x, inLocation.y);
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

    // Now draw the lines.
    this.moveTo(outLocation.x, outLocation.y);
    if (midA.x !== midB.x) {
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
    this.beginFill(color);
    this.drawCircle(outLocation.x, outLocation.y, 2);
    this.drawCircle(inLocation.x, inLocation.y, 2);
    this.endFill();
  }
}
