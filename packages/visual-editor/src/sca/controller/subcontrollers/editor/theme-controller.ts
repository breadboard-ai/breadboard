/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { hash } from "@breadboard-ai/utils";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

export { ThemeController };

export type ThemeStatus = "generating" | "uploading" | "editing" | "idle";

class ThemeController extends RootController {
  @field()
  accessor status: ThemeStatus = "idle";

  @field()
  accessor _themeHash: number = 0;

  get themeHash() {
    return this._themeHash;
  }

  /**
   * Computes and updates `themeHash` from the given graph's theme metadata.
   */
  updateHash(graph: GraphDescriptor | null | undefined) {
    const themes = graph?.metadata?.visual?.presentation?.themes;
    const theme = graph?.metadata?.visual?.presentation?.theme;
    if (themes && theme && themes[theme]) {
      this._themeHash = hash(themes[theme]);
    } else {
      this._themeHash = 0;
    }
  }
}
