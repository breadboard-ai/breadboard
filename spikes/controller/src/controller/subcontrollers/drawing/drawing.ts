/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-store.js";

export class DrawingController extends RootController {
  @field({ persist: "session" })
  private accessor _shapes: string[] = [];

  get shapes(): readonly string[] {
    return this._shapes;
  }

  addShape(shape: string) {
    this._shapes = [...this._shapes, shape];
  }

  setShapes(shapes: string[]) {
    this._shapes = shapes;
  }
}
