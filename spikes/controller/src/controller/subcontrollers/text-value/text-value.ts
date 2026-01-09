/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootStore } from "../root-store.js";

export class TextValueStore extends RootStore {
  @field({ persist: "local" })
  private accessor _textValue = "";

  get textValue() {
    return this._textValue;
  }

  setTextValue(value: string) {
    this._textValue = value;
  }
}
