/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { GraphNodeReferences } from "./types";
import { GraphNodeReference } from "./graph-node-reference";
import { PortIdentifier } from "@google-labs/breadboard";
import { getGlobalColor } from "./utils";

const edgeColorOrdinary = getGlobalColor("--bb-neutral-400");

export class GraphNodeReferenceContainer extends PIXI.Container {
  #isDirty = false;
  #references: GraphNodeReferences | null = null;
  #inPortLocations: Map<PortIdentifier, PIXI.ObservablePoint> | null = null;
  #edges = new PIXI.Graphics();

  constructor() {
    super();

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#isDirty = false;
      this.#draw();
    };

    this.on("destroyed", () => {
      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });

    this.addChild(this.#edges);
  }

  set inPortLocations(
    inPortLocations: Map<PortIdentifier, PIXI.ObservablePoint> | null
  ) {
    this.#inPortLocations = inPortLocations;
    this.#isDirty = true;
  }

  get inPortLocations() {
    return this.#inPortLocations;
  }

  set references(references: GraphNodeReferences | null) {
    this.#references = references;
    this.#isDirty = true;
  }

  get references() {
    return this.#references;
  }

  #createLabel(portId: PortIdentifier, title: string) {
    return `${portId}__$__${title}`;
  }

  #parseLabel(label: string) {
    return label.split("__$__");
  }

  #clearStaleReferences() {
    for (const child of this.children) {
      if (!(child instanceof GraphNodeReference)) {
        continue;
      }

      const [port, target] = this.#parseLabel(child.label);
      const ports = this.#references?.get(port);
      if (ports) {
        const reference = ports.find((ref) => ref.reference === target);
        if (reference) {
          continue;
        }
      }

      child.removeFromParent();
      child.destroy();
    }
  }

  #positionItemsAndDrawEdges() {
    this.#edges.clear();

    if (!this.#inPortLocations || !this.#references) {
      return;
    }

    for (const [port, references] of this.#references) {
      const location = this.#inPortLocations.get(port);
      if (!location) {
        continue;
      }

      const x = -30;
      let y = Math.round(
        location.y - references.length * GraphNodeReference.HEIGHT * 0.5
      );

      for (const reference of references) {
        const label = this.#createLabel(port, reference.reference);
        const nodeReference = this.getChildByLabel(label) as GraphNodeReference;
        if (!nodeReference) {
          continue;
        }

        nodeReference.x = x;
        nodeReference.y = y;

        y += GraphNodeReference.HEIGHT;

        const edgeX = x;
        const edgeY = y - GraphNodeReference.HEIGHT * 0.5;
        this.#edges.beginPath();
        this.#edges.moveTo(edgeX, edgeY);
        this.#edges.bezierCurveTo(
          edgeX - edgeX * 0.5,
          edgeY,
          edgeX * 0.5,
          location.y,
          6,
          location.y
        );
        this.#edges.stroke({ color: edgeColorOrdinary });
        this.#edges.closePath();
      }
    }
  }

  #draw() {
    if (this.#references) {
      for (const [port, references] of this.#references) {
        for (const reference of references) {
          const label = this.#createLabel(port, reference.reference);
          let nodeReference = this.getChildByLabel(label) as GraphNodeReference;
          if (!nodeReference) {
            nodeReference = new GraphNodeReference();
            nodeReference.label = label;
            this.addChild(nodeReference);
          }

          nodeReference.reference = reference;
        }
      }
    }

    this.#positionItemsAndDrawEdges();
    this.#clearStaleReferences();
  }
}
