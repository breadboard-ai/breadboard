/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { getGlobalColor } from "./utils.js";
import { GraphAssets } from "./graph-assets.js";

const textColor = getGlobalColor("--bb-neutral-900");
const borderColor = getGlobalColor("--bb-neutral-200");
const backgroundColor = getGlobalColor("--bb-neutral-100");
const hoverBackgroundColor = getGlobalColor("--bb-neutral-200");

const ICON_SCALE = 0.4;

export class GraphButton extends PIXI.Container {
  #isDirty = true;
  #hovering = false;

  #background = new PIXI.Graphics();
  #icon = "";
  #iconSprite: PIXI.Sprite | null = null;
  #label = new PIXI.Text({
    text: "",
    style: {
      fontFamily: "Arial",
      fontSize: 12,
      fill: textColor,
      align: "left",
      lineHeight: 24,
    },
  });

  constructor() {
    super();

    this.#background.cursor = "pointer";
    this.#label.eventMode = "none";

    this.addChild(this.#background);
    this.addChild(this.#label);

    this.#background.addEventListener("pointerover", () => {
      this.hovering = true;
    });

    this.#background.addEventListener("pointerout", () => {
      this.hovering = false;
    });

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#draw();
      this.#isDirty = false;
    };
  }

  set label(label: string) {
    if (label === this.#label.text) {
      return;
    }

    this.#label.text = label;
  }

  get label() {
    return this.#label.text;
  }

  set icon(icon: string) {
    if (icon === this.#icon) {
      return;
    }

    if (this.#iconSprite) {
      this.#iconSprite.removeFromParent();
      this.#iconSprite.destroy();
    }

    const texture = GraphAssets.instance().get(icon);
    if (texture) {
      this.#iconSprite = new PIXI.Sprite(texture);
      this.#iconSprite.scale.x = ICON_SCALE;
      this.#iconSprite.scale.y = ICON_SCALE;
      this.#iconSprite.x = 4;
      this.#iconSprite.y = 2;
      this.#iconSprite.alpha = 0.6;

      this.#iconSprite.eventMode = "none";
      this.addChild(this.#iconSprite);
    }
  }

  get icon() {
    return this.#icon;
  }

  set hovering(hovering: boolean) {
    if (hovering === this.#hovering) {
      return;
    }

    this.#hovering = hovering;
    this.#isDirty = true;
  }

  #draw() {
    let padding = 16;
    if (this.#iconSprite) {
      this.#label.x = 24;
      padding = 36;
    } else {
      this.#label.x = 8;
    }

    this.#background.clear();
    this.#background.beginPath();
    this.#background.roundRect(0, 0, this.#label.width + padding, 24);
    this.#background.closePath();
    this.#background.fill({
      color: this.#hovering ? hoverBackgroundColor : backgroundColor,
    });

    this.#background.stroke({ color: borderColor });
  }
}
