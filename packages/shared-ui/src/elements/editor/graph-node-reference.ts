/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { GRAPH_OPERATIONS, GraphNodeReferenceOpts } from "./types";
import { DBL_CLICK_DELTA, getGlobalColor } from "./utils";

const nodeTextColor = getGlobalColor("--bb-neutral-900");
const selectedNodeColor = getGlobalColor("--bb-ui-600");
const SUB_GRAPH_LABEL_TEXT_SIZE = 12;

export class GraphNodeReference extends PIXI.Container {
  static HEIGHT = 30;

  #isDirty = false;
  #selected = false;
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
  #lastClickTime = 0;

  constructor() {
    super();

    this.#title.eventMode = "none";
    this.#background.cursor = "pointer";
    this.addChild(this.#background);
    this.addChild(this.#title);

    this.addEventListener("click", (evt: PIXI.FederatedPointerEvent) => {
      const clickDelta = window.performance.now() - this.#lastClickTime;
      this.#lastClickTime = window.performance.now();

      if (!this.#reference?.reference) {
        return;
      }

      if (clickDelta > DBL_CLICK_DELTA) {
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

        this.emit(
          GRAPH_OPERATIONS.GRAPH_REFERENCE_TOGGLE_SELECTED,
          isCtrlCommand
        );
        return;
      }

      this.#lastClickTime = 0;
      this.emit(
        GRAPH_OPERATIONS.GRAPH_REFERENCE_GOTO,
        this.#reference.reference
      );
    });

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#isDirty = false;
      this.#draw();
    };

    this.on("destroyed", () => {
      // Prevent future renderings.
      this.#isDirty = false;

      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });
  }

  set selected(selected: boolean) {
    this.#selected = selected;
    this.#isDirty = true;
  }

  get selected() {
    return this.#selected;
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
    this.#background.stroke({
      color: this.#selected ? selectedNodeColor : this.#reference.color,
      width: this.#selected ? 2 : 1,
    });

    this.#background.beginPath();
    this.#background.circle(-12, h * 0.5, 5);
    this.#background.closePath();
    this.#background.fill({ color: this.#reference.color });

    this.#title.x = 10 - w;
    this.#title.y = 5;
  }
}
