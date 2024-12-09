/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { getGlobalColor } from "./utils";
import { GRAPH_OPERATIONS } from "./types";
import { ComponentActivityItem } from "../../types/types";

const inputColor = getGlobalColor("--bb-inputs-400");
const nodeColor = getGlobalColor("--bb-nodes-400");
const outputColor = getGlobalColor("--bb-boards-500");
const errorColor = getGlobalColor("--bb-warning-600");
const neutralColor = getGlobalColor("--bb-inputs-500");
const textColor = getGlobalColor("--bb-neutral-0");

const LABEL_HEIGHT = 14;

export class GraphNodeActivityMarker extends PIXI.Container {
  #isDirty = false;
  #background = new PIXI.Graphics();

  #radius = 4;
  #paddingVertical = 4;
  #paddingHorizonal = 8;
  #textSize = 12;
  #type = "";
  #color = 0;
  #activity: ComponentActivityItem[] | null = null;

  #label = new PIXI.Text({
    text: "0",
    style: {
      fontFamily: "Arial",
      fontSize: this.#textSize,
      fill: textColor,
      align: "center",
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

    this.on("destroyed", () => {
      // Prevent future renderings.
      this.#isDirty = false;

      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });

    this.addListener("pointerover", (evt: PIXI.FederatedPointerEvent) => {
      const message = "Click for component activity";
      const x = evt.clientX;
      const y = evt.clientY;

      this.emit(GRAPH_OPERATIONS.GRAPH_SHOW_TOOLTIP, message, x, y);
    });

    this.addListener("pointerout", () => {
      this.emit(GRAPH_OPERATIONS.GRAPH_HIDE_TOOLTIP);
    });

    this.addEventListener("click", () => {
      if (!this.#activity) {
        return;
      }

      const newestActivity = this.#activity[this.#activity.length - 1];
      if (!newestActivity) {
        return;
      }

      this.emit(
        GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED,
        getRunId(newestActivity.path)
      );
    });
  }

  get dimensions() {
    return {
      width: this.#label.width + 2 * this.#paddingHorizonal,
      height: LABEL_HEIGHT + 2 * this.#paddingVertical,
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

  set activity(activity: ComponentActivityItem[] | null) {
    this.#activity = activity;

    if (!activity || !activity.length) {
      this.visible = false;
      return;
    }

    this.visible = true;
    const newestActivity = activity[activity.length - 1];

    if (this.#label.text !== activity.length.toString()) {
      this.#label.text = activity.length;
    }

    switch (newestActivity.type) {
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

    // TODO: Decide if individual colors is helpful.
    if (newestActivity.type === "error") {
      this.#color = errorColor;
    } else {
      this.#color = neutralColor;
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
      LABEL_HEIGHT + 2 * this.#paddingVertical,
      this.#radius
    );

    this.#background.closePath();
    this.#background.fill({ color: this.#color });
  }
}

function getRunId(path: number[]) {
  return `e-${path.slice(0, -1).join(".")}`;
}
