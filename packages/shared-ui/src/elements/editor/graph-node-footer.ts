/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { GraphNodeActivityMarker } from "./graph-node-activity-marker";
import { GRAPH_OPERATIONS } from "./types";
import { ComponentActivityItem } from "../../types/types";
import { GraphAssets } from "./graph-assets";

const ICON_SCALE = 0.33;
const ICON_ALPHA_OUT = 0.3;
const ICON_ALPHA_OVER = 0.6;

export class GraphNodeFooter extends PIXI.Container {
  #width = 48;
  #height = 40;
  #padding = 12;
  #activityMarker = new GraphNodeActivityMarker();
  #nodeRunnerButton: PIXI.Sprite | null = null;
  #activity: ComponentActivityItem[] | null = null;
  #isDirty = false;
  #showNodeRunnerButton = false;

  readOnly = false;

  constructor() {
    super();

    const playIcon = GraphAssets.instance().get("play-filled");
    if (playIcon) {
      this.#nodeRunnerButton = new PIXI.Sprite(playIcon);
      this.#nodeRunnerButton.scale.x = ICON_SCALE;
      this.#nodeRunnerButton.scale.y = ICON_SCALE;
      this.#nodeRunnerButton.alpha = ICON_ALPHA_OUT;
      this.#nodeRunnerButton.cursor = "pointer";

      this.#nodeRunnerButton.addEventListener(
        "pointerover",
        (evt: PIXI.FederatedPointerEvent) => {
          evt.target.alpha = ICON_ALPHA_OVER;
        }
      );

      this.#nodeRunnerButton.addEventListener(
        "pointerout",
        (evt: PIXI.FederatedPointerEvent) => {
          evt.target.alpha = ICON_ALPHA_OUT;
        }
      );

      this.#nodeRunnerButton.addEventListener("click", () => {
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_RUN_REQUESTED);
      });

      this.addChild(this.#nodeRunnerButton);
    }

    this.addChild(this.#activityMarker);

    this.#activityMarker.on(
      GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED,
      (...args: unknown[]) => {
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED, ...args);
      }
    );

    this.#activityMarker.on(
      GRAPH_OPERATIONS.GRAPH_SHOW_TOOLTIP,
      (...args: unknown[]) => {
        this.emit(GRAPH_OPERATIONS.GRAPH_SHOW_TOOLTIP, ...args);
      }
    );

    this.#activityMarker.on(
      GRAPH_OPERATIONS.GRAPH_HIDE_TOOLTIP,
      (...args: unknown[]) => {
        this.emit(GRAPH_OPERATIONS.GRAPH_HIDE_TOOLTIP, ...args);
      }
    );

    this.onRender = () => {
      if (this.#isDirty) {
        this.#isDirty = false;
        this.#draw();
      }
    };
  }

  #draw() {
    if (this.#nodeRunnerButton) {
      this.#nodeRunnerButton.visible = this.#showNodeRunnerButton;
      this.#nodeRunnerButton.x = this.#padding;
      this.#nodeRunnerButton.y =
        (this.#height - this.#nodeRunnerButton.height) * 0.5;
    }

    this.#activityMarker.x =
      this.#width - this.#activityMarker.dimensions.width - this.#padding;
    this.#activityMarker.y =
      (this.#height - this.#activityMarker.dimensions.height) * 0.5;
  }

  set showNodeRunnerButton(showNodeRunnerButton: boolean) {
    if (showNodeRunnerButton === this.#showNodeRunnerButton) {
      return;
    }

    this.#showNodeRunnerButton = showNodeRunnerButton;
    this.#isDirty = true;
  }

  set footerWidth(width: number) {
    this.#width = width;
    this.#isDirty = true;
  }

  get footerWidth() {
    return this.#width;
  }

  set activity(activity: ComponentActivityItem[] | null) {
    this.#activity = activity;
    this.#activityMarker.activity = this.#activity;

    this.#isDirty = true;
  }

  get activity() {
    return this.#activity;
  }

  get dimensions() {
    return { width: this.#width, height: this.#height };
  }
}
