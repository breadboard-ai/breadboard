/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { GRAPH_OPERATIONS } from "./types.js";

const documentStyles = getComputedStyle(document.documentElement);

function getGlobalColor(name: string, defaultValue = "#333333") {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  return parseInt(value || defaultValue, 16);
}

const menuColor = getGlobalColor("--bb-neutral-600");

export class GraphOverflowMenu extends PIXI.Graphics {
  #isDirty = true;
  #radius = 1.5;
  #gap = 2;

  static readonly width = 24;
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
  }

  render(renderer: PIXI.Renderer) {
    super.render(renderer);

    if (this.#isDirty) {
      this.clear();
      this.#draw();
      this.#isDirty = false;
    }
  }

  #draw() {
    const midX = GraphOverflowMenu.width / 2;
    const midY = GraphOverflowMenu.height / 2;

    this.beginFill(menuColor);
    this.drawCircle(midX, midY - this.#gap - 2 * this.#radius, this.#radius);
    this.drawCircle(midX, midY, this.#radius);
    this.drawCircle(midX, midY + this.#gap + 2 * this.#radius, this.#radius);
    this.endFill();
  }
}
