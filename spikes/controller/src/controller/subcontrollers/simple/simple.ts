/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debug, debugContainer } from "../../decorators/debug.js";
import { field } from "../../decorators/field.js";
import { DebugHost } from "../../types.js";
import { RootStore } from "../root-store.js";

function clamp(v: number, min = 10, max = 90) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

@debugContainer({ path: "Shape" })
export class SimpleController extends RootStore {
  @field()
  private accessor _text = "";

  @field({ persist: "session" })
  private accessor _color = { r: 255, g: 0, b: 255 };

  @field({ persist: "local" })
  private accessor _invert = false;

  @field()
  private accessor _num = 50;

  get text() {
    return this._text;
  }
  set text(value: string) {
    this._text = value.trim();
  }

  @debug({ ui: { label: "Invert text color" }, log: true })
  get invert() {
    return this._invert;
  }
  set invert(value: boolean) {
    this._invert = value;
  }

  @debug({
    ui: {
      view: "slider",
      label: "Radius",
      min: -10,
      max: 200,
      step: 1,
    },
    log: {
      label: "Radius",
      format: (val: number, host: DebugHost) => {
        if (val < 40) return host.error(val);
        if (val >= 40 && val < 50) return host.info(val);
        if (val >= 50 && val < 90) return host.warning(val);
        return host.verbose(val);
      },
    },
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
