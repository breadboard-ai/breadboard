/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { getGlobalColor } from "./utils";
import { Activity, GRAPH_OPERATIONS } from "./types";

const inputColor = getGlobalColor("--bb-inputs-400");
const nodeColor = getGlobalColor("--bb-nodes-400");
const outputColor = getGlobalColor("--bb-boards-500");
const errorColor = getGlobalColor("--bb-warning-600");

export class GraphNodeActivityMarker extends PIXI.Container {
  #isDirty = false;
  #background = new PIXI.Graphics();

  #radius = 4;
  #paddingVertical = 4;
  #paddingHorizonal = 8;
  #textSize = 12;
  #type = "";
  #color = 0;
  #activity: Activity[] | null = null;

  #label = new PIXI.Text({
    text: "0",
    style: {
      fontFamily: "Arial",
      fontSize: this.#textSize,
      fill: 0xffffff,
      align: "center",
      textBaseline: "bottom",
      whiteSpace: "pre",
    },
  });

  constructor() {
    super();

    this.#background.cursor = "pointer";
    this.#background.eventMode = "static";
    this.#label.eventMode = "none";

    this.addChild(this.#background);
    this.addChild(this.#label);

    this.#label.x = this.#paddingHorizonal;
    this.#label.y = this.#paddingVertical;

    this.visible = false;

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#isDirty = false;
      this.#draw();
    };

    this.addEventListener("click", (_evt: PIXI.FederatedPointerEvent) => {
      if (!this.#activity) {
        return;
      }

      const newestActivity = this.#activity[this.#activity.length - 1];
      if (!newestActivity) {
        return;
      }

      this.emit(
        GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED,
        newestActivity.id
      );
    });
  }

  get dimensions() {
    return {
      width: this.#label.width + 2 * this.#paddingHorizonal,
      height: this.#label.height + 2 * this.#paddingVertical,
    };
  }

  get type() {
    return this.#type;
  }

  set type(type: string) {
    this.#type = type;
    this.#isDirty = true;
  }

  get activity() {
    return this.#activity;
  }

  set activity(activity: Activity[] | null) {
    this.#activity = activity;

    if (!activity || !activity.length) {
      this.visible = false;
      return;
    }

    this.visible = true;
    const newestActivity = activity[activity.length - 1];
    if (newestActivity.activity.length === 0) {
      return;
    }

    if (this.#label.text !== newestActivity.activity.length.toString()) {
      this.#label.text = newestActivity.activity.length;
    }

    const newestEntry =
      newestActivity.activity[newestActivity.activity.length - 1];
    switch (newestEntry.type) {
      case "input":
        this.#color = inputColor;
        break;

      case "output":
        this.#color = outputColor;
        break;

      case "error":
        this.#color = errorColor;
        break;

      default:
        this.#color = nodeColor;
        break;
    }

    this.#isDirty = true;
  }

  #draw() {
    this.#background.clear();

    this.#background.beginPath();
    this.#background.roundRect(
      0,
      0,
      this.#label.width + 2 * this.#paddingHorizonal,
      this.#label.height + 2 * this.#paddingVertical,
      this.#radius
    );
    this.#background.closePath();
    this.#background.fill({ color: this.#color });
  }
}
