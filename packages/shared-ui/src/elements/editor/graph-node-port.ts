/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as PIXI from "pixi.js";
import { GraphNodePortType } from "./types.js";
import { PortStatus } from "@google-labs/breadboard";
import { getGlobalColor } from "./utils.js";

const boardReferenceColor = getGlobalColor("--bb-joiner-500");

const connectedColor = getGlobalColor("--bb-inputs-200");
const danglingColor = getGlobalColor("--bb-warning-300");
const indeterminateColor = getGlobalColor("--bb-neutral-300");
const missingColor = getGlobalColor("--bb-warning-200");
const readyColor = getGlobalColor("--bb-neutral-200");
const configuredColor = getGlobalColor("--bb-ui-300");

const connectedBorderColor = getGlobalColor("--bb-inputs-600");
const danglingBorderColor = getGlobalColor("--bb-warning-700");
const indeterminateBorderColor = getGlobalColor("--bb-neutral-700");
const missingBorderColor = getGlobalColor("--bb-warning-600");
const readyBorderColor = getGlobalColor("--bb-neutral-600");
const configuredBorderColor = getGlobalColor("--bb-ui-600");

export class GraphNodePort extends PIXI.Graphics {
  #isDirty = true;
  #radius = 4;
  #status: PortStatus = PortStatus.Indeterminate;
  #configured = false;
  #colors: { [K in PortStatus]: number } & { configured: number } = {
    [PortStatus.Connected]: connectedColor,
    [PortStatus.Dangling]: danglingColor,
    [PortStatus.Indeterminate]: indeterminateColor,
    [PortStatus.Missing]: missingColor,
    [PortStatus.Ready]: readyColor,
    configured: configuredColor,
  };
  #borderColors: { [K in PortStatus]: number } & { configured: number } = {
    [PortStatus.Connected]: connectedBorderColor,
    [PortStatus.Dangling]: danglingBorderColor,
    [PortStatus.Indeterminate]: indeterminateBorderColor,
    [PortStatus.Missing]: missingBorderColor,
    [PortStatus.Ready]: readyBorderColor,
    configured: configuredBorderColor,
  };
  #overrideStatus: PortStatus | null = null;
  #readOnly = false;
  #showBoardReferenceMarker = false;

  constructor(public type: GraphNodePortType) {
    super();

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }
      this.#isDirty = false;
      this.clear();
      this.#draw();
    };
  }

  set readOnly(readOnly: boolean) {
    if (readOnly === this.#readOnly) {
      return;
    }

    this.#readOnly = readOnly;
    this.#isDirty = true;
  }

  get readOnly() {
    return this.#readOnly;
  }

  set radius(radius: number) {
    if (radius === this.#radius) {
      return;
    }

    this.#radius = radius;
    this.#isDirty = true;
  }

  get radius() {
    return this.#radius;
  }

  set showBoardReferenceMarker(showBoardReferenceMarker: boolean) {
    if (showBoardReferenceMarker === this.#showBoardReferenceMarker) {
      return;
    }

    this.#showBoardReferenceMarker = showBoardReferenceMarker;
    this.#isDirty = true;
  }

  get showBoardReferenceMarker() {
    return this.#showBoardReferenceMarker;
  }

  set configured(configured: boolean) {
    if (configured === this.#configured) {
      return;
    }

    this.#configured = configured;
    this.#isDirty = true;
  }

  get configured() {
    return this.#configured;
  }

  set overrideStatus(overrideStatus: PortStatus | null) {
    if (overrideStatus === this.#overrideStatus) {
      return;
    }

    this.#overrideStatus = overrideStatus;
    this.#isDirty = true;
  }

  get overrideStatus() {
    return this.#overrideStatus;
  }

  set status(status: PortStatus) {
    if (status === this.#status) {
      return;
    }

    this.#status = status;
    this.#isDirty = true;
  }

  get status() {
    return this.#status;
  }

  #draw() {
    // Adjust the hit area so it's a bit bigger.
    this.hitArea = new PIXI.Rectangle(
      -this.#radius * 2,
      -this.#radius * 2,
      this.#radius * 4,
      this.#radius * 4
    );

    const status = this.#overrideStatus ?? this.#status;
    this.setStrokeStyle({
      color: this.#configured
        ? this.#borderColors["configured"]
        : this.#borderColors[status],
      width: 1,
    });

    this.beginPath();
    this.circle(0, 0, this.#radius);
    this.fill({
      color: this.#configured
        ? this.#colors["configured"]
        : this.#colors[status],
    });
    this.stroke();
    this.closePath();

    if (this.#showBoardReferenceMarker) {
      const ratio = 1 / this.worldTransform.a;
      this.beginPath();
      this.circle(0, 0, 10 * ratio);
      this.stroke({
        color: boardReferenceColor,
        width: Math.round(4 * ratio),
      });
      this.closePath();
    }

    this.eventMode = "static";
    this.cursor = this.#readOnly ? undefined : "pointer";
  }
}
