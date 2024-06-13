/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { getGlobalColor } from "./utils.js";
import { GRAPH_OPERATIONS } from "./types.js";

const backgroundColor = getGlobalColor("--bb-ui-50");
const emptyTextColor = getGlobalColor("--bb-neutral-600");
const textColor = getGlobalColor("--bb-neutral-800");
const defaultBorderColor = getGlobalColor("--bb-neutral-500");
const selectedBorderColor = getGlobalColor("--bb-ui-600");

export class GraphComment extends PIXI.Container {
  #maxWidth = 180;
  #isDirty = true;
  #lineWidth = 1;
  #selectedLineWidth = 2;
  #borderRadius = 8;
  #padding = 12;
  #text: string | null = null;
  #textLabel = new PIXI.Text({
    text: "",
    style: {
      fontSize: 12,
      fontFamily: "Arial",
      fill: emptyTextColor,
      wordWrap: true,
      breakWords: true,
      wordWrapWidth: this.#maxWidth - 2 * this.#padding,
      lineHeight: 18,
    },
  });
  #editable = false;
  #selected = false;
  #background = new PIXI.Graphics();
  #defaultBorderColor = defaultBorderColor;
  #selectedBorderColor = selectedBorderColor;

  collapsed = false;

  constructor() {
    super();

    this.eventMode = "static";
    this.cursor = "pointer";
    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }
      this.#isDirty = false;
      this.#background.clear();
      this.#draw();

      this.emit(GRAPH_OPERATIONS.GRAPH_COMMENT_DRAWN);
    };

    this.#textLabel.eventMode = "none";
    this.#background.eventMode = "auto";

    this.addChild(this.#background);
    this.addChild(this.#textLabel);

    this.#textLabel.x = this.#padding;
    this.#textLabel.y = this.#padding;
  }

  addPointerEventListeners() {
    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let hasMoved = false;

    this.addEventListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      if (!(evt.target instanceof GraphComment)) {
        return;
      }

      hasMoved = false;
      dragStart = evt.global.clone();
      originalPosition = this.position.clone();
    });

    this.addEventListener(
      "globalpointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!dragStart || !originalPosition) {
          return;
        }

        const scale = this.worldTransform.a;
        const dragPosition = evt.global;
        const dragDeltaX = (dragPosition.x - dragStart.x) / scale;
        const dragDeltaY = (dragPosition.y - dragStart.y) / scale;

        this.x = Math.round(originalPosition.x + dragDeltaX);
        this.y = Math.round(originalPosition.y + dragDeltaY);
        hasMoved = true;

        this.cursor = "grabbing";
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, false);
      }
    );

    const onPointerUp = () => {
      dragStart = null;
      originalPosition = null;
      if (!hasMoved) {
        return;
      }

      hasMoved = false;
      this.cursor = "pointer";
      this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, true);
    };

    this.addEventListener("pointerupoutside", onPointerUp);
    this.addEventListener("pointerup", onPointerUp);
  }

  set selected(selected: boolean) {
    if (this.#selected === selected) {
      return;
    }

    this.#selected = selected;
    this.#isDirty = true;
  }

  get selected() {
    return this.#selected;
  }

  set editable(editable: boolean) {
    this.#editable = editable;
  }

  get editable() {
    return this.#editable;
  }

  set text(text: string | null) {
    if (text === this.#text) {
      return;
    }

    this.#isDirty = true;
    this.#text = text;
    if (!text) {
      this.#textLabel.text = "No comment";
      this.#textLabel.style.fill = emptyTextColor;
      this.#textLabel.style.fontStyle = "italic";
      return;
    }

    this.#textLabel.text = text;
    this.#textLabel.style.fill = textColor;
    this.#textLabel.style.fontStyle = "normal";
  }

  get text() {
    return this.#text;
  }

  #draw() {
    const width = Math.max(100, this.#textLabel.width + this.#padding * 2);
    const height = this.#textLabel.height + this.#padding * 2;

    const borderWidth = this.selected
      ? this.#selectedLineWidth
      : this.#lineWidth;
    const borderColor = this.selected
      ? this.#selectedBorderColor
      : this.#defaultBorderColor;

    this.#background.beginPath();
    this.#background.roundRect(0, 0, width, height, this.#borderRadius);
    this.#background.stroke({ color: borderColor, width: borderWidth });
    this.#background.fill({ color: backgroundColor, alpha: 0.1 });
    this.#background.closePath();
  }
}
