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

import { css, CSSResultGroup, unsafeCSS } from "lit";
import { grid } from "./shared.js";

export const border = css`
  ${unsafeCSS(
    new Array(25)
      .fill(0)
      .map((_, idx) => {
        return `
        .border-bw-${idx} { border-width: ${idx}px; }
        .border-btw-${idx} { border-top-width: ${idx}px; }
        .border-bbw-${idx} { border-bottom-width: ${idx}px; }
        .border-blw-${idx} { border-left-width: ${idx}px; }
        .border-brw-${idx} { border-right-width: ${idx}px; }

        .border-ow-${idx} { outline-width: ${idx}px; }
        .border-br-${idx} { border-radius: ${idx * grid}px; overflow: hidden;}`;
      })
      .join("\n")
  )}

  .border-br-50pc {
    border-radius: 50%;
  }

  .border-bs-s {
    border-style: solid;
  }
` as CSSResultGroup;
