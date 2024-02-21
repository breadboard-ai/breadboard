import * as PIXI from "pixi.js";
import { GraphNodePortType } from "./types.js";
import { InteractionTracker } from "./interaction-tracker.js";
import { PortStatus } from "@google-labs/breadboard";

export class GraphNodePort extends PIXI.Graphics {
  #isDirty = true;
  #radius = 3;
  #status: PortStatus = PortStatus.Connected;
  #colors: { [K in PortStatus]: number } = {
    [PortStatus.Connected]: 0xaced8f,
    [PortStatus.Dangling]: 0xdf4646,
    [PortStatus.Inteterminate]: 0xcccccc,
    [PortStatus.Missing]: 0xdf4646,
    [PortStatus.Ready]: 0xeeeeee,
  };
  #borderColors: { [K in PortStatus]: number } = {
    [PortStatus.Connected]: 0x475d3f,
    [PortStatus.Dangling]: 0x990808,
    [PortStatus.Inteterminate]: 0xbbbbbb,
    [PortStatus.Missing]: 0x990808,
    [PortStatus.Ready]: 0xaaaaaa,
  };
  #editable = false;

  constructor(public type: GraphNodePortType) {
    super();

    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerdown", () => {
      if (!this.editable) {
        return;
      }

      InteractionTracker.instance().activeGraphNodePort = this;
    });

    let oldStatus: PortStatus;
    this.on("pointerover", () => {
      if (!this.editable) {
        return;
      }

      oldStatus = this.#status;
      InteractionTracker.instance().hoveredGraphNodePort = this;
    });

    this.on("pointerout", () => {
      if (!this.editable) {
        return;
      }

      InteractionTracker.instance().hoveredGraphNodePort = null;
      this.status = oldStatus;
    });
  }

  set connectedColor(color: number) {
    this.#colors.connected = color;
  }

  get connectedColor() {
    return this.#colors.connected;
  }

  set connectedBorderColor(color: number) {
    this.#borderColors.connected = color;
  }

  get connectedBorderColor() {
    return this.#borderColors.connected;
  }

  set editable(editable: boolean) {
    this.#editable = editable;
  }

  get editable() {
    return this.#editable;
  }

  set radius(radius: number) {
    this.#radius = radius;
    this.#isDirty = true;
  }

  get radius() {
    return this.#radius;
  }

  set status(status: PortStatus) {
    this.#status = status;
    this.#isDirty = true;
  }

  get status() {
    return this.#status;
  }

  render(renderer: PIXI.Renderer): void {
    if (this.#isDirty) {
      this.#isDirty = false;
      this.#draw();
    }
    super.render(renderer);
  }

  #draw() {
    // Adjust the hit area so it's a bit bigger.
    this.hitArea = new PIXI.Rectangle(
      -this.#radius * 2,
      -this.#radius * 2,
      this.#radius * 4,
      this.#radius * 4
    );

    this.lineStyle({
      color: this.#borderColors[this.status],
      width: 1,
    });
    this.beginFill(this.#colors[this.status]);
    this.drawCircle(0, 0, this.#radius);
    this.endFill();
  }
}
