/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ParticlesUI from "@breadboard-ai/particles-ui";
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
  ParticleUIImage,
  iframe,
  horizontal,
  input,
  list,
  listItems,
  p,
  pre,
  segmentHorizontal,
  segmentHorizontalPadded,
  segmentVertical,
  segmentVerticalPadded,
  textarea,
  vertical,
  video,
  ParticleUIAudio,
  ParticleUIVideo,
  borderTop,
  media,
  ParticleUIText,
} from "./shared.js";

const aLight = ParticlesUI.Utils.merge(a, { "color-c-n5": true });
const inputLight = ParticlesUI.Utils.merge(input, { "color-c-n5": true });
const textareaLight = ParticlesUI.Utils.merge(textarea, { "color-c-n5": true });
const buttonLight = ParticlesUI.Utils.merge(button, { "color-c-n100": true });
const h1Light = ParticlesUI.Utils.merge(h1, { "color-c-n5": true });
const h2Light = ParticlesUI.Utils.merge(h2, { "color-c-n5": true });
const h3Light = ParticlesUI.Utils.merge(h3, { "color-c-n5": true });
const bodyLight = ParticlesUI.Utils.merge(body, { "color-c-n5": true });
const pLight = ParticlesUI.Utils.merge(p, { "color-c-n35": true });
const preLight = ParticlesUI.Utils.merge(pre, { "color-c-n35": true });

export const theme: ParticlesUI.Types.UITheme = {
  elements: {
    a: aLight,
    audio,
    body: bodyLight,
    button: buttonLight,
    h1: h1Light,
    h2: h2Light,
    h3: h3Light,
    iframe,
    input: inputLight,
    p: pLight,
    pre: preLight,
    textarea: textareaLight,
    video,
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
    borderTop,
    media,
  },
  groups: {
    card,
    list,
    listItems,
    segmentVertical,
    segmentVerticalPadded,
    segmentHorizontal,
    segmentHorizontalPadded,
  },
  viewers: {
    "particle-ui-image": ParticleUIImage,
    "particle-ui-audio": ParticleUIAudio,
    "particle-ui-video": ParticleUIVideo,
    "particle-ui-text": ParticleUIText,
  },
  markdown: {
    p: [...Object.keys(pLight), "layout-mb-2"],
    h1: [...Object.keys(h1Light), "layout-mb-2"],
    h2: [...Object.keys(h2Light), "layout-mb-2"],
    h3: [...Object.keys(h3Light), "layout-mb-2"],
    h4: [],
    h5: [],
    h6: [],
    ul: [],
    ol: [],
    li: [],
    a: [...Object.keys(aLight)],
    strong: [],
    em: [],
  },
};
