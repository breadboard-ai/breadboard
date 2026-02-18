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

import { css } from "lit";

/**
 * Shared g-icon CSS for A2UI components.
 *
 * This is a standalone copy of the Google Symbols icon styles, kept
 * separate from `ui/styles/icons.ts` so that A2UI remains independent
 * of the wider UI system. Import into any component's `static styles`
 * array to enable `<span class="g-icon">icon_name</span>` usage.
 */
export const icons = css`
  .g-icon {
    font-family: "Google Symbols";
    font-weight: normal;
    font-style: normal;
    font-display: optional;
    font-size: 20px;
    width: 1em;
    height: 1em;
    user-select: none;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
    overflow: hidden;

    --icon-fill: 0;
    --icon-wght: 300;
    --icon-grad: 0;
    --icon-opsz: 48;
    --icon-rond: 0;

    font-variation-settings:
      "FILL" var(--icon-fill),
      "wght" var(--icon-wght),
      "GRAD" var(--icon-grad),
      "opsz" var(--icon-opsz),
      "ROND" var(--icon-rond);

    &.filled {
      --icon-fill: 1;
    }

    &.round {
      --icon-rond: 100;
    }

    &.heavy {
      --icon-wght: 700;
    }

    & > svg {
      width: 1em;
      height: 1em;
      fill: currentColor;
    }
  }
`;
