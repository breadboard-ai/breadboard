/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debug, debugContainer } from "../../decorators/debug.js";
import { field } from "../../decorators/field.js";
import { RootStore } from "../root-store.js";

function clamp(v: number, min = 10, max = 90) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

@debugContainer({ path: "simple/primitives" })
export class SimpleStore extends RootStore {
  @field()
  private accessor _text = "";

  @field({ persist: "session" })
  private accessor _color = { r: 255, g: 0, b: 255 };

  @field({ persist: "local" })
  private accessor _boolean = false;

  @field()
  private accessor _num = 50;

  @debug()
  get text() {
    return this._text;
  }
  set text(value: string) {
    this._text = value.trim();
  }

  @debug({ label: "Awesome value" })
  get boolean() {
    return this._boolean;
  }
  set boolean(value: boolean) {
    this._boolean = value;
  }

  @debug({
    view: "slider",
    label: "Slide Value",
    min: -10,
    max: 200,
    step: 1,
  })
  get num() {
    return this._num;
  }
  set num(value: number) {
    this._num = clamp(value, 20, 120);
  }

  @debug()
  get color() {
    return this._color;
  }
  set color(value: { r: number; g: number; b: number }) {
    this._color = value;
  }
}
