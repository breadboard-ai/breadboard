import * as PIXI from "pixi.js";
import { GraphNodePortType } from "./types.js";
import { InteractionTracker } from "./interaction-tracker.js";

export class GraphNodePort extends PIXI.Graphics {
  #isDirty = true;
  #radius = 3;
  #borderInactiveColor = 0xbbbbbb;
  #borderActiveColor = 0x475d3f;
  #activeColor = 0xaced8f;
  #inactiveColor = 0xdddddd;
  #active = false;
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

    let defaultActive: typeof this.active;
    this.on("pointerover", () => {
      if (!this.editable) {
        return;
      }

      defaultActive = this.active;
      InteractionTracker.instance().hoveredGraphNodePort = this;
    });

    this.on("pointerout", () => {
      if (!this.editable) {
        return;
      }

      InteractionTracker.instance().hoveredGraphNodePort = null;
      this.active = defaultActive;
    });
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

  set active(active: boolean) {
    this.#active = active;
    this.#isDirty = true;
  }

  get active() {
    return this.#active;
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
      color: this.#active ? this.#borderActiveColor : this.#borderInactiveColor,
      width: 1,
    });
    this.beginFill(this.#active ? this.#activeColor : this.#inactiveColor);
    this.drawCircle(0, 0, this.#radius);
    this.endFill();
  }
}
