/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { customElement } from "lit/decorators.js";
import { MainBase } from "./main-base";

export { Main };

@customElement("bb-main")
class Main extends MainBase {}

declare global {
  interface HTMLElementTagNameMap {
    "bb-main": Main;
  }
}
