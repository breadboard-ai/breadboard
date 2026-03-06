/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Design token system for generated components.
 *
 * Every token is a CSS custom property. The system prompt references these
 * by name so the model uses them instead of hardcoding values.
 *
 * Tokens are organized into tiers:
 *
 * 1. **Core tokens** — colors, typography, spacing, radius, elevation, motion.
 *    Always sent to the model. These are the baseline vocabulary.
 *
 * 2. **Expressive tokens** — border style, heading transforms, image treatments,
 *    list markers, hover behavior, divider decoration. Always sent.
 *    These give themes structural personality beyond just colors.
 *
 * 3. **Layout tokens** — columns, gap, max-width, card direction, section
 *    spacing, sidebar width, media aspect ratios. Conditionally sent via
 *    the settings toggle. When included, the model writes CSS that responds
 *    to these tokens, making themes able to reshape layout.
 *
 * All tokens have sensible CSS defaults, so components render correctly
 * regardless of whether the model was told about layout tokens.
 */

export { getExpressiveTokenReference, getLayoutTokenReference };

export const DESIGN_TOKENS_CSS = `
:root {
  /* ═══════════════════════════════════════════════════════════
     TIER 1 — Core Tokens
     ═══════════════════════════════════════════════════════════ */

  /* ───── Color Palette (Dark / Lime) ───── */

  /* Neutral surface tones */
  --cg-color-surface-dim:      #0a0a0a;
  --cg-color-surface:          #121212;
  --cg-color-surface-bright:   #1e1e1e;
  --cg-color-surface-container-lowest:  #0e0e0e;
  --cg-color-surface-container-low:     #1a1a1a;
  --cg-color-surface-container:         #222222;
  --cg-color-surface-container-high:    #2a2a2a;
  --cg-color-surface-container-highest: #333333;

  /* Text on surfaces */
  --cg-color-on-surface:       #f0f0f0;
  --cg-color-on-surface-muted: #8a8a8a;

  /* Primary accent — lime green */
  --cg-color-primary:          #a3e635;
  --cg-color-primary-container:#1a2e05;
  --cg-color-on-primary:       #0a0a0a;
  --cg-color-on-primary-container: #d9f99d;

  /* Secondary accent — cool blue */
  --cg-color-secondary:        #60a5fa;
  --cg-color-secondary-container: #0c2d6b;
  --cg-color-on-secondary:     #0a0a0a;
  --cg-color-on-secondary-container: #bfdbfe;

  /* Tertiary accent — warm amber */
  --cg-color-tertiary:         #fbbf24;
  --cg-color-tertiary-container: #451a03;
  --cg-color-on-tertiary:      #0a0a0a;
  --cg-color-on-tertiary-container: #fef3c7;

  /* Error */
  --cg-color-error:            #ef4444;
  --cg-color-error-container:  #450a0a;
  --cg-color-on-error:         #0a0a0a;
  --cg-color-on-error-container: #fecaca;

  /* Borders and outlines */
  --cg-color-outline:          #404040;
  --cg-color-outline-variant:  #2a2a2a;

  /* ───── Typography ───── */

  --cg-font-sans:   'Inter', 'Helvetica Neue', sans-serif;
  --cg-font-mono:   'JetBrains Mono', 'Fira Code', 'Courier New', monospace;

  /* Display */
  --cg-text-display-lg-size:        57px;
  --cg-text-display-lg-line-height: 64px;
  --cg-text-display-lg-weight:      400;

  --cg-text-display-md-size:        45px;
  --cg-text-display-md-line-height: 52px;
  --cg-text-display-md-weight:      400;

  --cg-text-display-sm-size:        36px;
  --cg-text-display-sm-line-height: 44px;
  --cg-text-display-sm-weight:      400;

  /* Headline */
  --cg-text-headline-lg-size:       32px;
  --cg-text-headline-lg-line-height:40px;
  --cg-text-headline-lg-weight:     600;

  --cg-text-headline-md-size:       28px;
  --cg-text-headline-md-line-height:36px;
  --cg-text-headline-md-weight:     600;

  --cg-text-headline-sm-size:       24px;
  --cg-text-headline-sm-line-height:32px;
  --cg-text-headline-sm-weight:     600;

  /* Title */
  --cg-text-title-lg-size:          22px;
  --cg-text-title-lg-line-height:   28px;
  --cg-text-title-lg-weight:        500;

  --cg-text-title-md-size:          16px;
  --cg-text-title-md-line-height:   24px;
  --cg-text-title-md-weight:        500;

  --cg-text-title-sm-size:          14px;
  --cg-text-title-sm-line-height:   20px;
  --cg-text-title-sm-weight:        500;

  /* Body */
  --cg-text-body-lg-size:           16px;
  --cg-text-body-lg-line-height:    24px;
  --cg-text-body-lg-weight:         400;

  --cg-text-body-md-size:           14px;
  --cg-text-body-md-line-height:    20px;
  --cg-text-body-md-weight:         400;

  --cg-text-body-sm-size:           12px;
  --cg-text-body-sm-line-height:    16px;
  --cg-text-body-sm-weight:         400;

  /* Label */
  --cg-text-label-lg-size:          14px;
  --cg-text-label-lg-line-height:   20px;
  --cg-text-label-lg-weight:        500;

  --cg-text-label-md-size:          12px;
  --cg-text-label-md-line-height:   16px;
  --cg-text-label-md-weight:        500;

  --cg-text-label-sm-size:          11px;
  --cg-text-label-sm-line-height:   16px;
  --cg-text-label-sm-weight:        500;

  /* ───── Spacing (4px grid) ───── */

  --cg-sp-0:  0px;
  --cg-sp-1:  4px;
  --cg-sp-2:  8px;
  --cg-sp-3:  12px;
  --cg-sp-4:  16px;
  --cg-sp-5:  20px;
  --cg-sp-6:  24px;
  --cg-sp-7:  28px;
  --cg-sp-8:  32px;
  --cg-sp-9:  36px;
  --cg-sp-10: 40px;
  --cg-sp-12: 48px;
  --cg-sp-16: 64px;

  /* ───── Border Radius ───── */

  --cg-radius-xs:   4px;
  --cg-radius-sm:   8px;
  --cg-radius-md:   12px;
  --cg-radius-lg:   16px;
  --cg-radius-xl:   24px;
  --cg-radius-full: 9999px;

  /* ───── Elevation (box-shadow) ───── */

  --cg-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
  --cg-elevation-2: 0 3px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  --cg-elevation-3: 0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06);

  /* ───── Motion ───── */

  --cg-motion-duration-short:  150ms;
  --cg-motion-duration-medium: 250ms;
  --cg-motion-duration-long:   400ms;
  --cg-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --cg-motion-easing-decel:    cubic-bezier(0, 0, 0, 1);
  --cg-motion-easing-accel:    cubic-bezier(0.3, 0, 1, 1);

  /* ───── Skeleton / Loading ───── */

  --cg-skeleton-bg:    var(--cg-color-surface-container-high);
  --cg-skeleton-shine: var(--cg-color-surface-container-highest);

  /* ───── Component Tokens ───── */

  /* Card */
  --cg-card-bg:       var(--cg-color-surface-container);
  --cg-card-radius:   var(--cg-radius-md);
  --cg-card-padding:  var(--cg-sp-4);
  --cg-card-shadow:   var(--cg-elevation-1);

  /* Button */
  --cg-button-radius:     var(--cg-radius-full);
  --cg-button-padding:    var(--cg-sp-2) var(--cg-sp-5);
  --cg-button-bg:         var(--cg-color-primary);
  --cg-button-color:      var(--cg-color-on-primary);
  --cg-button-font-size:  var(--cg-text-label-lg-size);
  --cg-button-font-weight:var(--cg-text-label-lg-weight);

  /* Input */
  --cg-input-bg:          transparent;
  --cg-input-border:      var(--cg-color-outline);
  --cg-input-radius:      var(--cg-radius-sm);
  --cg-input-padding:     var(--cg-sp-3) var(--cg-sp-4);
  --cg-input-color:       var(--cg-color-on-surface);
  --cg-input-placeholder: var(--cg-color-on-surface-muted);

  /* Badge / Tag */
  --cg-badge-bg:          var(--cg-color-primary-container);
  --cg-badge-color:       var(--cg-color-on-primary-container);
  --cg-badge-radius:      var(--cg-radius-full);
  --cg-badge-padding:     var(--cg-sp-1) var(--cg-sp-3);
  --cg-badge-font-size:   var(--cg-text-label-sm-size);

  /* Divider */
  --cg-divider-color:     var(--cg-color-outline-variant);
  --cg-divider-thickness: 1px;

  /* ═══════════════════════════════════════════════════════════
     TIER 2 — Expressive Tokens
     These give themes structural personality beyond colors.
     ═══════════════════════════════════════════════════════════ */

  /* ───── Border Treatment ───── */
  --cg-border-style:       solid;
  --cg-border-width:       1px;

  /* ───── Heading Treatment ───── */
  --cg-heading-transform:       none;
  --cg-heading-letter-spacing:  normal;
  --cg-heading-font-style:      normal;

  /* ───── Image Treatment ───── */
  --cg-img-radius:    var(--cg-radius-md);
  --cg-img-border:    none;
  --cg-img-shadow:    var(--cg-elevation-1);
  --cg-img-filter:    none;

  /* ───── List Marker Treatment ───── */
  --cg-list-marker-type:   disc;
  --cg-list-marker-color:  var(--cg-color-primary);

  /* ───── Divider Decoration ───── */
  --cg-divider-style:     solid;

  /* ───── Hover / Interactive ───── */
  --cg-hover-scale:       1;
  --cg-hover-brightness:  1.05;
  --cg-hover-shadow:      var(--cg-elevation-2);

  /* ═══════════════════════════════════════════════════════════
     TIER 3 — Layout Tokens
     Conditionally sent to the model via settings toggle.
     Defaults work for all content; themes can reshape layout.
     ═══════════════════════════════════════════════════════════ */

  /* ───── Grid / Column Layout ───── */
  --cg-layout-columns:     1;
  --cg-layout-gap:         var(--cg-sp-4);

  /* ───── Content Sizing ───── */
  --cg-content-max-width:  none;
  --cg-content-padding:    var(--cg-sp-5);

  /* ───── Card Layout ───── */
  --cg-card-direction:     column;

  /* ───── Section Rhythm ───── */
  --cg-section-spacing:    var(--cg-sp-8);

  /* ───── Sidebar ───── */
  --cg-sidebar-width:      280px;

  /* ───── Media ───── */
  --cg-media-aspect-ratio: auto;
}

/* ───── Base Reset ───── */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--cg-font-sans);
  font-size: var(--cg-text-body-md-size);
  line-height: var(--cg-text-body-md-line-height);
  color: var(--cg-color-on-surface);
  background: var(--cg-color-surface);
  -webkit-font-smoothing: antialiased;
}
`;

// ─── Token name extraction ─────────────────────────────────────

/** Extract unique --cg-* token names from a CSS string. */
function extractTokenNames(css: string): string[] {
  const names = [...css.matchAll(/--(cg-[\w-]+)/g)].map((m) => m[1]);
  return [...new Set(names)];
}

/** Token names from each tier, derived from the CSS markers. */
const TIER_MARKERS = {
  expressive: "TIER 2",
  layout: "TIER 3",
};

function sliceTier(css: string, marker: string): string {
  const start = css.indexOf(marker);
  if (start === -1) return "";
  // Find the next TIER marker or end of :root.
  const nextTier = css.indexOf("TIER", start + marker.length);
  const end = nextTier !== -1 ? nextTier : css.indexOf("}", start);
  return css.slice(start, end);
}

/**
 * Returns the token reference for **core + expressive** tokens.
 * Always included in the system prompt.
 */
function getExpressiveTokenReference(): string {
  // Everything except layout tokens.
  const layoutSection = sliceTier(DESIGN_TOKENS_CSS, TIER_MARKERS.layout);
  const layoutNames = new Set(extractTokenNames(layoutSection));
  const allNames = extractTokenNames(DESIGN_TOKENS_CSS);
  const coreExpressive = allNames.filter((n) => !layoutNames.has(n));

  return [
    "Available CSS custom properties (use var(--name) for all styling):",
    "",
    ...coreExpressive.map((t) => `  --${t}`),
  ].join("\\n");
}

/**
 * Returns the token reference for **layout** tokens.
 * Only included when the user enables layout tokens in settings.
 */
function getLayoutTokenReference(): string {
  const layoutSection = sliceTier(DESIGN_TOKENS_CSS, TIER_MARKERS.layout);
  const layoutNames = extractTokenNames(layoutSection);

  return [
    "",
    "# Layout Design Tokens",
    "",
    "The following layout tokens are available. Use them to make your component",
    "responsive to theme-driven layout changes. Themes may override these values",
    "to reshape your component's layout (e.g., single-column vs multi-column,",
    "narrow book-page vs wide editorial spread).",
    "",
    "Write your CSS so that layout responds to these tokens — for example:",
    "`gridTemplateColumns: \\`repeat(var(--cg-layout-columns), 1fr)\\``",
    "`maxWidth: 'var(--cg-content-max-width)'`",
    "`flexDirection: 'var(--cg-card-direction)'`",
    "",
    ...layoutNames.map((t) => `  --${t}`),
  ].join("\\n");
}
