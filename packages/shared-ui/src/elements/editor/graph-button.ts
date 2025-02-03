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
  #title = new PIXI.Text({
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
    this.#title.eventMode = "none";

    this.addChild(this.#background);
    this.addChild(this.#title);

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

  set title(title: string) {
    if (title === this.#title.text) {
      return;
    }

    this.#title.text = title;
  }

  get title() {
    return this.#title.text;
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
      this.#iconSprite.x = 8;
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
      this.#title.x = 32;
      padding = 44;
    } else {
      this.#title.x = 8;
    }

    this.#background.clear();
    this.#background.beginPath();
    this.#background.roundRect(0, 0, this.#title.width + padding, 24);
    this.#background.closePath();
    this.#background.fill({
      color: this.#hovering ? hoverBackgroundColor : backgroundColor,
    });

    this.#background.stroke({ color: borderColor });
  }
}
