/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootStore } from "../root-store.js";

export class SimpleStore extends RootStore {
  @field()
  private accessor _text = "";

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
