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

/**
 * Semantic design tokens for the A2UI theming system.
 *
 * These are CSS custom property names that components reference via `var()`.
 * The theme provider sets their values on a host element, and they cascade
 * through Shadow DOM boundaries to all child components.
 */

/** All recognized token CSS custom property names. */
export const TOKENS = {
  // Typography
  fontFamily: "--a2ui-font-family",
  fontFamilyFlex: "--a2ui-font-family-flex",
  fontFamilyMono: "--a2ui-font-family-mono",

  // Semantic colors
  colorSurface: "--a2ui-color-surface",
  colorOnSurface: "--a2ui-color-on-surface",
  colorPrimary: "--a2ui-color-primary",
  colorOnPrimary: "--a2ui-color-on-primary",
  colorSecondary: "--a2ui-color-secondary",
  colorBorder: "--a2ui-color-border",
  colorBackdrop: "--a2ui-color-backdrop",

  // Spacing scale (grid = 4px)
  spacing1: "--a2ui-spacing-1",
  spacing2: "--a2ui-spacing-2",
  spacing3: "--a2ui-spacing-3",
  spacing4: "--a2ui-spacing-4",
  spacing5: "--a2ui-spacing-5",
  spacing6: "--a2ui-spacing-6",

  // Border
  borderRadius: "--a2ui-border-radius",
  borderRadiusLg: "--a2ui-border-radius-lg",
  borderRadiusXl: "--a2ui-border-radius-xl",
  borderRadiusFull: "--a2ui-border-radius-full",
  borderWidth: "--a2ui-border-width",

  // Behavior
  hoverOpacity: "--a2ui-hover-opacity",
  transitionSpeed: "--a2ui-transition-speed",

  // Button
  buttonRadius: "--a2ui-button-radius",

  // Image controls
  imageButtonBg: "--a2ui-image-button-bg",
  imageButtonBgHover: "--a2ui-image-button-bg-hover",
  imageButtonColor: "--a2ui-image-button-color",
  imageButtonSize: "--a2ui-image-button-size",

  // Text: input-prompt variant
  textInputPromptFontFamily: "--a2ui-text-input-prompt-font-family",
  textInputPromptFontSize: "--a2ui-text-input-prompt-font-size",
  textInputPromptLineHeight: "--a2ui-text-input-prompt-line-height",
  textInputPromptFontWeight: "--a2ui-text-input-prompt-font-weight",
  textInputPromptTextAlign: "--a2ui-text-input-prompt-text-align",
  textInputPromptFontVariation: "--a2ui-text-input-prompt-font-variation",

  // Text: heading variants (h1–h5)
  textH1FontFamily: "--a2ui-text-h1-font-family",
  textH1FontSize: "--a2ui-text-h1-font-size",
  textH1LineHeight: "--a2ui-text-h1-line-height",
  textH1FontWeight: "--a2ui-text-h1-font-weight",
  textH1TextAlign: "--a2ui-text-h1-text-align",
  textH1FontVariation: "--a2ui-text-h1-font-variation",

  textH2FontSize: "--a2ui-text-h2-font-size",
  textH2LineHeight: "--a2ui-text-h2-line-height",

  textH3FontSize: "--a2ui-text-h3-font-size",
  textH3LineHeight: "--a2ui-text-h3-line-height",

  textH4FontSize: "--a2ui-text-h4-font-size",
  textH4LineHeight: "--a2ui-text-h4-line-height",

  textH5FontSize: "--a2ui-text-h5-font-size",
  textH5LineHeight: "--a2ui-text-h5-line-height",

  // Text: h2-h5 shared base
  textSubheadingFontFamily: "--a2ui-text-subheading-font-family",
  textSubheadingFontWeight: "--a2ui-text-subheading-font-weight",
  textSubheadingTextAlign: "--a2ui-text-subheading-text-align",
  textSubheadingFontVariation: "--a2ui-text-subheading-font-variation",
  textSubheadingColor: "--a2ui-text-subheading-color",

  // Text: caption/body
  textBodyFontSize: "--a2ui-text-body-font-size",
  textBodyLineHeight: "--a2ui-text-body-line-height",
  textBodyColor: "--a2ui-text-body-color",
} as const;

/** The values for each token. Keys match the property names in TOKENS. */
export type ThemeTokens = Record<(typeof TOKENS)[keyof typeof TOKENS], string>;

/**
 * Applies all token values as CSS custom properties on an element.
 */
export function applyTokens(el: HTMLElement, tokens: ThemeTokens): void {
  for (const [prop, value] of Object.entries(tokens)) {
    el.style.setProperty(prop, value);
  }
}

/**
 * Applies component-level CSS custom property overrides on an element.
 */
export function applyOverrides(
  el: HTMLElement,
  overrides: Record<string, string> | undefined
): void {
  if (!overrides) return;
  for (const [prop, value] of Object.entries(overrides)) {
    el.style.setProperty(prop, value);
  }
}
