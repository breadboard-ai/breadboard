/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { GraphNodeReferenceOpts } from "./types";
import { getGlobalColor } from "./utils";

const nodeTextColor = getGlobalColor("--bb-neutral-900");
const SUB_GRAPH_LABEL_TEXT_SIZE = 12;

export class GraphNodeReference extends PIXI.Container {
  static HEIGHT = 30;

  #isDirty = false;
  #reference: GraphNodeReferenceOpts[number] | null = null;
  #background = new PIXI.Graphics();
  #title = new PIXI.Text({
    text: "",
    style: {
      fontFamily: "Arial",
      fontSize: SUB_GRAPH_LABEL_TEXT_SIZE,
      fill: nodeTextColor,
      align: "left",
    },
  });

  constructor() {
    super();

    this.addChild(this.#background);
    this.addChild(this.#title);

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#isDirty = false;
      this.#draw();
    };
  }

  set reference(reference: GraphNodeReferenceOpts[number] | null) {
    this.#reference = reference;
    this.#isDirty = true;
  }

  get reference() {
    return this.#reference;
  }

  #draw() {
    this.#background.clear();
    if (!this.#reference) {
      this.#title.text = "";
      return;
    }

    if (this.#title.text !== this.#reference.title) {
      this.#title.text = this.#reference.title;
    }

    const w = this.#title.width + 40;
    const h = this.#title.height + 12;

    this.#background.beginPath();
    this.#background.roundRect(-w, 0, w, h, 50);
    this.#background.closePath();
    this.#background.fill({ color: 0xffffff });
    this.#background.stroke({ color: this.#reference.color });

    this.#background.beginPath();
    this.#background.circle(-12, h * 0.5, 5);
    this.#background.closePath();
    this.#background.fill({ color: this.#reference.color });

    this.#title.x = 10 - w;
    this.#title.y = 5;

    // TODO: Render the line to the target.
  }
}
