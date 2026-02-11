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

import { Root } from "../root.js";

export { detectMedia };

/**
 * Recursively walks the DOM tree to detect media content.
 *
 * A component is considered media if it is a `Root` instance with
 * `isMedia === true`. This enables both built-in media components (Image,
 * Video, AudioPlayer set `isMedia` in `renderComponentTree`) and custom
 * elements (which override `isMedia = true`) to be discovered.
 *
 * @param el - The root element to search from.
 * @returns `true` if any descendant is a media component.
 */
function detectMedia(el: Element): boolean {
  if (el instanceof Root && el.isMedia) return true;
  for (const child of el.children) {
    if (detectMedia(child)) return true;
  }
  return false;
}
