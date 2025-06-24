/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ParticlesUI from "@breadboard-ai/particles-ui";
import { UITheme } from "../../shared/theme/theme.js";
import {
  a,
  audio,
  body,
  button,
  card,
  cover,
  disabled,
  h1,
  h2,
  h3,
  headline,
  hero,
  image,
  iframe,
  horizontal,
  input,
  list,
  listItems,
  media,
  p,
  pre,
  segmentHorizontal,
  segmentHorizontalPadded,
  segmentVertical,
  segmentVerticalPadded,
  textarea,
  vertical,
  video,
} from "./shared.js";

const aEx = ParticlesUI.Utils.merge(a, { "color-c-n5": true });
const inputEx = ParticlesUI.Utils.merge(input, { "color-c-n5": true });
const textareaEx = ParticlesUI.Utils.merge(textarea, { "color-c-n5": true });
const buttonEx = ParticlesUI.Utils.merge(button, { "color-c-n100": true });
const h1Ex = ParticlesUI.Utils.merge(h1, { "color-c-n5": true });
const h2Ex = ParticlesUI.Utils.merge(h2, { "color-c-n5": true });
const h3Ex = ParticlesUI.Utils.merge(h3, { "color-c-n5": true });
const bodyEx = ParticlesUI.Utils.merge(body, { "color-c-n5": true });
const pEx = ParticlesUI.Utils.merge(p, { "color-c-n35": true });
const preEx = ParticlesUI.Utils.merge(pre, { "color-c-n35": true });

export const theme: UITheme = {
  elements: {
    audio,
    a: aEx,
    input: inputEx,
    textarea: textareaEx,
    button: buttonEx,
    h1: h1Ex,
    h2: h2Ex,
    h3: h3Ex,
    body: bodyEx,
    p: pEx,
    pre: preEx,
    iframe,
    video,
  },
  components: {
    card,
    image,
    list,
    listItems,
    media,
    segmentVertical,
    segmentVerticalPadded,
    segmentHorizontal,
    segmentHorizontalPadded,
  },
  layouts: {
    vertical,
    verticalPadded: {
      ...vertical,
      "layout-p-3": true,
    },
    horizontal,
    horizontalPadded: {
      ...horizontal,
      "layout-p-3": true,
    },
  },
  modifiers: {
    hero,
    headline,
    disabled,
    cover,
    borderTop: {
      "border-bw-0": true,
      "border-btw-1": true,
      "color-bc-n90": true,
      "border-bs-s": true,
    },
  },
  markdown: {
    p: [...Object.keys(pEx), "layout-mb-2"],
    h1: [...Object.keys(h1Ex), "layout-mb-2"],
    h2: [...Object.keys(h2Ex), "layout-mb-2"],
    h3: [...Object.keys(h3Ex), "layout-mb-2"],
    h4: [],
    h5: [],
    h6: [],
    ul: [],
    ol: [],
    li: [],
    a: [...Object.keys(aEx)],
    strong: [],
    em: [],
  },
};
