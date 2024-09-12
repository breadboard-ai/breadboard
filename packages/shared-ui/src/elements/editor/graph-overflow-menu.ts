/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { GRAPH_OPERATIONS } from "./types.js";
import { getGlobalColor } from "./utils.js";

const menuColor = getGlobalColor("--bb-neutral-600");

export class GraphOverflowMenu extends PIXI.Graphics {
  #isDirty = true;
  #radius = 1.5;
  #gap = 2;

  static readonly width = 20;
  static readonly height = 16;

  constructor() {
    super();

    this.hitArea = new PIXI.Rectangle(
      0,
      0,
      GraphOverflowMenu.width,
      GraphOverflowMenu.height
    );

    this.cursor = "pointer";
    this.eventMode = "static";

    this.addEventListener("click", (evt: PIXI.FederatedPointerEvent) => {
      this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MENU_CLICKED, evt.client);
    });

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }
      this.clear();
      this.#draw();
      this.#isDirty = false;
    };
  }

  #draw() {
    const midX = GraphOverflowMenu.width / 2;
    const midY = GraphOverflowMenu.height / 2;

    this.beginPath();
    this.circle(midX, midY - this.#gap - 2 * this.#radius, this.#radius);
    this.circle(midX, midY, this.#radius);
    this.circle(midX, midY + this.#gap + 2 * this.#radius, this.#radius);
    this.fill({ color: menuColor });
    this.closePath();
  }
}
