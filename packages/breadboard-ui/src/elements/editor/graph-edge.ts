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
  #padding = 25;
  #overrideInLocation: PIXI.ObservablePoint<unknown> | null = null;
  #overrideOutLocation: PIXI.ObservablePoint<unknown> | null = null;

  constructor(
    public fromNode: GraphNode,
    public toNode: GraphNode,
    public readonly temporary = false
  ) {
    super();
  }

  set edge(edge: InspectableEdge | null) {
    this.#edge = edge;
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
    if (this.#isDirty) {
      this.#draw();
      this.#isDirty = false;
    }
    super.render(renderer);
  }

  forceRedraw() {
    this.#isDirty = true;
  }

  #draw() {
    if (!this.#edge) {
      return;
    }

    this.clear();

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

    const midX = Math.round((inLocation.x - outLocation.x) / 2);
    const midY = Math.round((inLocation.y - outLocation.y) / 2);
    const color =
      this.#overrideColor ?? this.fromNode.edgeColor ?? this.#edgeColor;

    this.lineStyle(2, color);
    this.moveTo(outLocation.x, outLocation.y);

    if (
      this.fromNode === this.toNode &&
      !this.#overrideInLocation &&
      !this.#overrideOutLocation
    ) {
      // Loopback
      this.lineTo(outLocation.x + this.#padding, outLocation.y);
      this.lineTo(
        outLocation.x + this.#padding,
        outLocation.y + this.fromNode.height / 2 + this.#padding
      );
      this.lineTo(
        inLocation.x - this.#padding,
        outLocation.y + this.fromNode.height / 2 + this.#padding
      );
      this.lineTo(inLocation.x - this.#padding, inLocation.y);
      this.lineTo(inLocation.x, inLocation.y);
      return;
    }

    const curve = 5;
    let curveY = outLocation.y > inLocation.y ? -curve : curve;
    let curveX = curve;
    if (Math.abs(outLocation.y - inLocation.y) < 4 * curve) {
      curveY = 0;
    }

    if (midX > this.#padding) {
      this.lineTo(outLocation.x + midX - curve, outLocation.y);
      this.quadraticCurveTo(
        outLocation.x + midX,
        outLocation.y,
        outLocation.x + midX,
        outLocation.y + curveY
      );
      this.lineTo(outLocation.x + midX, inLocation.y - curveY);
      this.quadraticCurveTo(
        outLocation.x + midX,
        inLocation.y,
        outLocation.x + midX + curveX,
        inLocation.y
      );
      this.lineTo(inLocation.x, inLocation.y);
    } else {
      // Ensure the edge won't come back on itself in the middle.
      if (
        inLocation.x - this.#padding + curveX >
        outLocation.x + this.#padding - curveX
      ) {
        curveX = 0;
      }

      this.lineTo(outLocation.x + this.#padding - curveX, outLocation.y);
      this.quadraticCurveTo(
        outLocation.x + this.#padding,
        outLocation.y,
        outLocation.x + this.#padding,
        outLocation.y + curveY
      );
      this.lineTo(outLocation.x + this.#padding, outLocation.y + midY - curveY);
      this.quadraticCurveTo(
        outLocation.x + this.#padding,
        outLocation.y + midY,
        outLocation.x + this.#padding - curveX,
        outLocation.y + midY
      );
      this.lineTo(inLocation.x - this.#padding + curveX, outLocation.y + midY);
      this.quadraticCurveTo(
        inLocation.x - this.#padding,
        outLocation.y + midY,
        inLocation.x - this.#padding,
        outLocation.y + midY + curveY
      );
      this.lineTo(inLocation.x - this.#padding, inLocation.y - curveY);
      this.quadraticCurveTo(
        inLocation.x - this.#padding,
        inLocation.y,
        inLocation.x - this.#padding + curveX,
        inLocation.y
      );
      this.lineTo(inLocation.x, inLocation.y);
    }

    // Circles at the start & end.
    this.beginFill(color);
    this.drawCircle(outLocation.x, outLocation.y, 2);
    this.drawCircle(inLocation.x, inLocation.y, 2);
    this.endFill();
  }
}
