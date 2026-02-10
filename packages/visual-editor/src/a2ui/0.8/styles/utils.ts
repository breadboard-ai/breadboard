/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { ColorPalettes } from "../types/colors.js";

export function createThemeStyles(
  palettes: ColorPalettes
): Record<string, string> {
  const styles: Record<string, string> = {};
  for (const palette of Object.values(palettes)) {
    for (const [key, val] of Object.entries(palette)) {
      const prop = toProp(key);
      styles[prop] = val;
    }
  }

  return styles;
}

export function toProp(key: string) {
  if (key.startsWith("nv")) {
    return `--light-dark-nv-${key.slice(2)}`;
  }

  return `--light-dark-${key[0]}-${key.slice(1)}`;
}
