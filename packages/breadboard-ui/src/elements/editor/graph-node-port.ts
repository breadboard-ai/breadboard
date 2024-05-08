import * as PIXI from "pixi.js";
import { GraphNodePortType } from "./types.js";
import { PortStatus } from "@google-labs/breadboard";

const documentStyles = getComputedStyle(document.documentElement);

function getGlobalColor(name: string, defaultValue = "#333333") {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  return parseInt(value || defaultValue, 16);
}

const connectedColor = getGlobalColor("--bb-inputs-300");
const danglingColor = getGlobalColor("--bb-warning-400");
const indeterminateColor = getGlobalColor("--bb-neutral-400");
const missingColor = getGlobalColor("--bb-warning-300");
const readyColor = getGlobalColor("--bb-neutral-200");
const configuredColor = getGlobalColor("--bb-boards-500");

const connectedBorderColor = getGlobalColor("--bb-inputs-700");
const danglingBorderColor = getGlobalColor("--bb-warning-800");
const indeterminateBorderColor = getGlobalColor("--bb-neutral-800");
const missingBorderColor = getGlobalColor("--bb-warning-700");
const readyBorderColor = getGlobalColor("--bb-neutral-700");
const configuredBorderColor = getGlobalColor("--bb-boards-700");

export class GraphNodePort extends PIXI.Graphics {
  #isDirty = true;
  #radius = 3;
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
  #editable = false;
  #overrideStatus: PortStatus | null = null;

  constructor(public type: GraphNodePortType) {
    super();

    this.eventMode = "static";
    this.cursor = "pointer";
  }

  set editable(editable: boolean) {
    this.#editable = editable;
  }

  get editable() {
    return this.#editable;
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

  render(renderer: PIXI.Renderer): void {
    super.render(renderer);

    if (this.#isDirty) {
      this.#isDirty = false;
      this.clear();
      this.#draw();
    }
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
    this.lineStyle({
      color: this.#configured
        ? this.#borderColors["configured"]
        : this.#borderColors[status],
      width: 1,
    });

    this.beginFill(
      this.#configured ? this.#colors["configured"] : this.#colors[status]
    );
    this.drawCircle(0, 0, this.#radius);
    this.endFill();
  }
}
