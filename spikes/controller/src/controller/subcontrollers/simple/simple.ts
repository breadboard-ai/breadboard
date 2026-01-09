/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debug, debugContainer } from "../../decorators/debug.js";
import { field } from "../../decorators/field.js";
import { RootStore } from "../root-store.js";

@debugContainer({ path: "simple/primitives" })
export class SimpleStore extends RootStore {
  @field()
  private accessor _text = "";

  @debug()
  @field({ persist: "session" })
  private accessor _color = { r: 255, g: 0, b: 255 };

  @debug({
    label: "Awesome value",
  })
  @field({ persist: "local" })
  private accessor _truefalse = false;

  @debug({
    view: "slider",
    label: "Slide Value",
    min: 10,
    max: 200,
    step: 1,
  })
  @field()
  private accessor _num = 0;

  get text() {
    return this._text;
  }

  setText(value: string) {
    this._text = value;
  }

  get num() {
    return this._num;
  }

  setNum(value: number) {
    this._num = value;
  }
}
