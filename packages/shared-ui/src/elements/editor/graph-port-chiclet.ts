/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { getGlobalColor } from "./utils.js";
import { GraphAssets } from "./graph-assets.js";

const assetBorderColor = getGlobalColor("--bb-asset-100");
const assetBackgroundColor = getGlobalColor("--bb-asset-50");
const assetTextColor = getGlobalColor("--bb-asset-700");

const toolBorderColor = getGlobalColor("--bb-tool-100");
const toolBackgroundColor = getGlobalColor("--bb-tool-50");
const toolTextColor = getGlobalColor("--bb-tool-700");

const inBorderColor = getGlobalColor("--bb-input-100");
const inBackgroundColor = getGlobalColor("--bb-input-50");
const inTextColor = getGlobalColor("--bb-input-700");

const ICON_SCALE = 0.32;

export class GraphPortChiclet extends PIXI.Container {
  #isDirty = true;

  #textColor = 0xcccccc;
  #backgroundColor = 0xffffff;
  #borderColor = 0xcccccc;
  #background = new PIXI.Graphics();
  #iconSprite: PIXI.Sprite | null = null;
  #title: PIXI.Text;

  constructor(title: string, type: string) {
    super();

    this.#background.cursor = "pointer";
    if (title.length > 32) {
      title = title.substring(0, 29) + "...";
    }

    let icon = "text";
    switch (type) {
      case "asset": {
        this.#backgroundColor = assetBackgroundColor;
        this.#borderColor = assetBorderColor;
        this.#textColor = assetTextColor;
        icon = "text";
        break;
      }

      case "tool": {
        this.#backgroundColor = toolBackgroundColor;
        this.#borderColor = toolBorderColor;
        this.#textColor = toolTextColor;
        icon = "tool";
        break;
      }

      case "in": {
        this.#backgroundColor = inBackgroundColor;
        this.#borderColor = inBorderColor;
        this.#textColor = inTextColor;
        icon = "output";
        break;
      }
    }

    this.#title = new PIXI.Text({
      text: title,
      style: {
        fontFamily: "Arial",
        fontSize: 12,
        fill: this.#textColor,
        align: "left",
        lineHeight: 24,
      },
    });
    this.#title.eventMode = "none";

    this.addChild(this.#background);
    this.addChild(this.#title);

    const texture = GraphAssets.instance().get(icon);
    if (texture) {
      this.#iconSprite = new PIXI.Sprite(texture);
      this.#iconSprite.scale.x = ICON_SCALE;
      this.#iconSprite.scale.y = ICON_SCALE;
      this.#iconSprite.x = 8;
      this.#iconSprite.y = 4;

      this.#iconSprite.eventMode = "none";
      this.addChild(this.#iconSprite);
    }

    this.#draw();

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#draw();
      this.#isDirty = false;
    };
  }

  #draw() {
    let padding = 16;
    if (this.#iconSprite) {
      this.#title.x = 28;
      padding = 36;
    } else {
      this.#title.x = 8;
    }

    this.#background.clear();
    this.#background.beginPath();
    this.#background.roundRect(0, 0, this.#title.width + padding, 24);
    this.#background.closePath();
    this.#background.fill({
      color: this.#backgroundColor,
    });

    this.#background.stroke({ color: this.#borderColor });
  }
}
