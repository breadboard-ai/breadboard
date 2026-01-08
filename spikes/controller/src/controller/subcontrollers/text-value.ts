/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { api } from "../decorators/api.js";

export class TextValueStore {
  @api({ persist: "local" })
  private accessor _textValue = "";

  get textValue() {
    return this._textValue;
  }

  setTextValue(value: string) {
    this._textValue = value;
  }
}
