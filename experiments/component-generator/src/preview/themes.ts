/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Theme presets.
 *
 * Each theme overrides colors, typography, radius, spacing, shadows, and
 * structural tokens to create dramatically different visual identities.
 * The base DESIGN_TOKENS_CSS is always injected first, then the theme
 * override is layered on top via a `<style id="theme-override">` element.
 */

export { THEMES, type Theme };

interface Theme {
  id: string;
  name: string;
  /** CSS that overrides :root tokens. */
  css: string;
  /** Emoji label for the switcher button. */
  icon: string;
}

const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    icon: "🌙",
    css: `/* Default dark/lime — no overrides needed */`,
  },
  {
    id: "editorial",
    name: "Editorial",
    icon: "📰",
    css: `:root {
  /* ── Surfaces: warm cream paper ── */
  --cg-color-surface-dim:      #e0d8c8;
  --cg-color-surface:          #f8f4eb;
  --cg-color-surface-bright:   #fffdf7;
  --cg-color-surface-container-lowest:  #fffdf7;
  --cg-color-surface-container-low:     #f2ecdf;
  --cg-color-surface-container:         #e8e0d0;
  --cg-color-surface-container-high:    #ddd4c2;
  --cg-color-surface-container-highest: #d0c7b4;

  /* ── Text: rich ink ── */
  --cg-color-on-surface:       #1a1008;
  --cg-color-on-surface-muted: #7a6e5a;

  /* ── Primary: dark forest green ── */
  --cg-color-primary:          #2d5e3f;
  --cg-color-primary-container:#d4eadb;
  --cg-color-on-primary:       #ffffff;
  --cg-color-on-primary-container: #0f3520;

  /* ── Secondary: warm brown ── */
  --cg-color-secondary:        #6b5340;
  --cg-color-secondary-container: #f0e4d8;
  --cg-color-on-secondary:     #ffffff;
  --cg-color-on-secondary-container: #3d2a1c;

  /* ── Tertiary: burgundy ── */
  --cg-color-tertiary:         #8b3a3a;
  --cg-color-tertiary-container: #f6dada;
  --cg-color-on-tertiary:      #ffffff;
  --cg-color-on-tertiary-container: #5c1818;

  /* ── Error ── */
  --cg-color-error:            #a02020;
  --cg-color-error-container:  #fde8e6;
  --cg-color-on-error:         #ffffff;
  --cg-color-on-error-container: #6a0c08;

  /* ── Borders: visible, editorial ── */
  --cg-color-outline:          #b0a890;
  --cg-color-outline-variant:  #d0c8b0;

  /* ── Skeleton ── */
  --cg-skeleton-bg:    #ddd4c2;
  --cg-skeleton-shine: #d0c7b4;

  /* ── Typography: serif, tighter, editorial feel ── */
  --cg-font-sans: 'Playfair Display', 'Georgia', serif;
  --cg-text-body-md-size: 15px;
  --cg-text-body-md-line-height: 26px;
  --cg-text-headline-lg-weight: 800;
  --cg-text-headline-md-weight: 700;

  /* ── Radius: razor sharp — editorial doesn't round ── */
  --cg-radius-xs:   0px;
  --cg-radius-sm:   2px;
  --cg-radius-md:   3px;
  --cg-radius-lg:   4px;
  --cg-radius-xl:   6px;
  --cg-radius-full: 9999px;

  /* ── Spacing: slightly more generous ── */
  --cg-sp-3: 14px;
  --cg-sp-4: 20px;
  --cg-sp-5: 28px;
  --cg-sp-6: 36px;

  /* ── Component overrides ── */
  --cg-card-bg:      var(--cg-color-surface-bright);
  --cg-card-radius:  0px;
  --cg-card-shadow:  none;
  --cg-card-padding: var(--cg-sp-5);
  --cg-btn-radius:   2px;
  --cg-divider-color: var(--cg-color-outline);
  --cg-divider-thickness: 2px;

  /* ── Expressive ── */
  --cg-border-style:       solid;
  --cg-border-width:       1px;
  --cg-heading-transform:  uppercase;
  --cg-heading-letter-spacing: 0.04em;
  --cg-heading-font-style: normal;
  --cg-img-radius:    0px;
  --cg-img-border:    none;
  --cg-img-shadow:    none;
  --cg-img-filter:    sepia(0.15);
  --cg-list-marker-type:   square;
  --cg-list-marker-color:  var(--cg-color-tertiary);
  --cg-divider-style:      double;
  --cg-hover-scale:        1;
  --cg-hover-brightness:   1;

  /* ── Layout ── */
  --cg-layout-columns:     2;
  --cg-content-max-width:  900px;
  --cg-section-spacing:    var(--cg-sp-10);
  --cg-card-direction:     row;
}`,
  },
  {
    id: "ocean",
    name: "Ocean",
    icon: "🌊",
    css: `:root {
  /* ── Surfaces: deep under-sea blue ── */
  --cg-color-surface-dim:      #040c18;
  --cg-color-surface:          #081428;
  --cg-color-surface-bright:   #101e38;
  --cg-color-surface-container-lowest:  #060e1e;
  --cg-color-surface-container-low:     #0c1a30;
  --cg-color-surface-container:         #122548;
  --cg-color-surface-container-high:    #1a3060;
  --cg-color-surface-container-highest: #244078;

  /* ── Text: pale ice ── */
  --cg-color-on-surface:       #d0e4ff;
  --cg-color-on-surface-muted: #5a80b0;

  /* ── Primary: electric cyan ── */
  --cg-color-primary:          #00e5ff;
  --cg-color-primary-container:#042838;
  --cg-color-on-primary:       #041020;
  --cg-color-on-primary-container: #80f0ff;

  /* ── Secondary: neon magenta ── */
  --cg-color-secondary:        #ff4ec4;
  --cg-color-secondary-container: #300828;
  --cg-color-on-secondary:     #041020;
  --cg-color-on-secondary-container: #ffa0e0;

  /* ── Tertiary: electric yellow ── */
  --cg-color-tertiary:         #eeff41;
  --cg-color-tertiary-container: #282c08;
  --cg-color-on-tertiary:      #041020;
  --cg-color-on-tertiary-container: #f8ffa0;

  /* ── Error ── */
  --cg-color-error:            #ff3d3d;
  --cg-color-error-container:  #380808;
  --cg-color-on-error:         #041020;
  --cg-color-on-error-container: #ffb0b0;

  /* ── Borders: glowing blue ── */
  --cg-color-outline:          #1a3060;
  --cg-color-outline-variant:  #122548;

  /* ── Skeleton ── */
  --cg-skeleton-bg:    #1a3060;
  --cg-skeleton-shine: #244078;

  /* ── Typography: wide, futuristic ── */
  --cg-text-body-md-size: 14px;
  --cg-text-body-md-line-height: 22px;
  --cg-text-label-sm-size: 11px;
  --cg-text-headline-lg-weight: 700;

  /* ── Radius: very bubbly, pill-shaped ── */
  --cg-radius-xs:   8px;
  --cg-radius-sm:   16px;
  --cg-radius-md:   24px;
  --cg-radius-lg:   32px;
  --cg-radius-xl:   40px;
  --cg-radius-full: 9999px;

  /* ── Component overrides ── */
  --cg-card-bg:      var(--cg-color-surface-container);
  --cg-card-radius:  var(--cg-radius-lg);
  --cg-card-padding: var(--cg-sp-5);
  --cg-btn-radius:   var(--cg-radius-full);

  /* ── Elevation: cyan glow ── */
  --cg-elevation-1: 0 0 12px rgba(0, 229, 255, 0.08);
  --cg-elevation-2: 0 0 24px rgba(0, 229, 255, 0.12);
  --cg-elevation-3: 0 0 40px rgba(0, 229, 255, 0.18);

  /* ── Expressive ── */
  --cg-border-style:       solid;
  --cg-border-width:       1px;
  --cg-heading-transform:  uppercase;
  --cg-heading-letter-spacing: 0.06em;
  --cg-img-radius:    var(--cg-radius-full);
  --cg-img-border:    2px solid var(--cg-color-primary);
  --cg-img-shadow:    0 0 20px rgba(0, 229, 255, 0.25);
  --cg-img-filter:    brightness(1.1) hue-rotate(10deg);
  --cg-list-marker-type:   '▸ ';
  --cg-list-marker-color:  var(--cg-color-secondary);
  --cg-divider-style:      solid;
  --cg-hover-scale:        1.03;
  --cg-hover-brightness:   1.15;
  --cg-hover-shadow:       0 0 30px rgba(0, 229, 255, 0.3);

  /* ── Layout ── */
  --cg-content-padding:    var(--cg-sp-6);
  --cg-media-aspect-ratio: 16/9;
}`,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    icon: "🏗️",
    css: `:root {
  /* ── Surfaces: stark white ── */
  --cg-color-surface-dim:      #e0e0e0;
  --cg-color-surface:          #ffffff;
  --cg-color-surface-bright:   #ffffff;
  --cg-color-surface-container-lowest:  #ffffff;
  --cg-color-surface-container-low:     #f5f5f5;
  --cg-color-surface-container:         #eeeeee;
  --cg-color-surface-container-high:    #e0e0e0;
  --cg-color-surface-container-highest: #cccccc;

  /* ── Text: pure black ── */
  --cg-color-on-surface:       #000000;
  --cg-color-on-surface-muted: #555555;

  /* ── Primary: electric red ── */
  --cg-color-primary:          #ff0000;
  --cg-color-primary-container:#ffe0e0;
  --cg-color-on-primary:       #ffffff;
  --cg-color-on-primary-container: #990000;

  /* ── Secondary: stark black ── */
  --cg-color-secondary:        #000000;
  --cg-color-secondary-container: #e0e0e0;
  --cg-color-on-secondary:     #ffffff;
  --cg-color-on-secondary-container: #000000;

  /* ── Tertiary: industrial yellow ── */
  --cg-color-tertiary:         #ffd600;
  --cg-color-tertiary-container: #fff8cc;
  --cg-color-on-tertiary:      #000000;
  --cg-color-on-tertiary-container: #665500;

  /* ── Error ── */
  --cg-color-error:            #ff0000;
  --cg-color-error-container:  #fff0f0;
  --cg-color-on-error:         #ffffff;
  --cg-color-on-error-container: #aa0000;

  /* ── Borders: thick black lines ── */
  --cg-color-outline:          #000000;
  --cg-color-outline-variant:  #333333;

  /* ── Skeleton ── */
  --cg-skeleton-bg:    #e0e0e0;
  --cg-skeleton-shine: #cccccc;

  /* ── Typography: monospace, all-caps vibes ── */
  --cg-font-sans: 'JetBrains Mono', 'Courier New', monospace;
  --cg-text-body-md-size: 13px;
  --cg-text-body-md-line-height: 20px;
  --cg-text-headline-lg-size: 28px;
  --cg-text-headline-lg-line-height: 34px;
  --cg-text-headline-lg-weight: 800;

  /* ── Radius: zero — hard edges only ── */
  --cg-radius-xs:   0px;
  --cg-radius-sm:   0px;
  --cg-radius-md:   0px;
  --cg-radius-lg:   0px;
  --cg-radius-xl:   0px;
  --cg-radius-full: 0px;

  /* ── Spacing: tight grid ── */
  --cg-sp-1: 4px;
  --cg-sp-2: 8px;
  --cg-sp-3: 12px;
  --cg-sp-4: 16px;
  --cg-sp-5: 20px;
  --cg-sp-6: 24px;

  /* ── Component overrides ── */
  --cg-card-bg:      #ffffff;
  --cg-card-radius:  0px;
  --cg-card-shadow:  none;
  --cg-card-padding: var(--cg-sp-4);
  --cg-btn-radius:   0px;
  --cg-divider-color: #000000;
  --cg-divider-thickness: 3px;

  /* ── Elevation: none — use borders ── */
  --cg-elevation-1: none;
  --cg-elevation-2: none;
  --cg-elevation-3: none;

  /* ── Expressive ── */
  --cg-border-style:       double;
  --cg-border-width:       3px;
  --cg-heading-transform:  uppercase;
  --cg-heading-letter-spacing: 0.1em;
  --cg-heading-font-style: normal;
  --cg-img-radius:    0px;
  --cg-img-border:    3px solid #000000;
  --cg-img-shadow:    none;
  --cg-img-filter:    grayscale(1) contrast(1.2);
  --cg-list-marker-type:   square;
  --cg-list-marker-color:  var(--cg-color-primary);
  --cg-divider-style:      double;
  --cg-hover-scale:        1;
  --cg-hover-brightness:   1;

  /* ── Layout ── */
  --cg-layout-columns:     1;
  --cg-layout-gap:         var(--cg-sp-2);
  --cg-content-max-width:  640px;
  --cg-content-padding:    var(--cg-sp-4);
  --cg-card-direction:     column;
  --cg-section-spacing:    var(--cg-sp-6);
}`,
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    icon: "🫧",
    css: `:root {
  /* ── Surfaces: candy pastel rainbow ── */
  --cg-color-surface-dim:      #ffe0f0;
  --cg-color-surface:          #fff5fa;
  --cg-color-surface-bright:   #fffafd;
  --cg-color-surface-container-lowest:  #fffafd;
  --cg-color-surface-container-low:     #fff0f6;
  --cg-color-surface-container:         #ffe4ef;
  --cg-color-surface-container-high:    #ffd6e8;
  --cg-color-surface-container-highest: #ffc8e0;

  /* ── Text: rich plum ── */
  --cg-color-on-surface:       #3e1050;
  --cg-color-on-surface-muted: #9e5880;

  /* ── Primary: bubblegum pink ── */
  --cg-color-primary:          #ff3399;
  --cg-color-primary-container:#ffe0f0;
  --cg-color-on-primary:       #ffffff;
  --cg-color-on-primary-container: #cc0066;

  /* ── Secondary: electric lime green ── */
  --cg-color-secondary:        #76ff03;
  --cg-color-secondary-container: #e8ffe0;
  --cg-color-on-secondary:     #1a4400;
  --cg-color-on-secondary-container: #33aa00;

  /* ── Tertiary: vivid sky blue ── */
  --cg-color-tertiary:         #00b0ff;
  --cg-color-tertiary-container: #e0f4ff;
  --cg-color-on-tertiary:      #ffffff;
  --cg-color-on-tertiary-container: #0066aa;

  /* ── Error ── */
  --cg-color-error:            #ff1744;
  --cg-color-error-container:  #ffe0e6;
  --cg-color-on-error:         #ffffff;
  --cg-color-on-error-container: #cc0022;

  /* ── Borders: soft candy pink ── */
  --cg-color-outline:          #f0a0c0;
  --cg-color-outline-variant:  #ffd0e4;

  /* ── Skeleton ── */
  --cg-skeleton-bg:    #ffe0f0;
  --cg-skeleton-shine: #ffc8e0;

  /* ── Typography: rounded, bouncy Comic Neue ── */
  --cg-font-sans: 'Comic Neue', 'Comic Sans MS', cursive;
  --cg-text-body-md-size: 17px;
  --cg-text-body-md-line-height: 28px;
  --cg-text-headline-lg-size: 36px;
  --cg-text-headline-lg-weight: 700;
  --cg-text-title-md-weight: 700;

  /* ── Radius: super bubbly, pillow-soft ── */
  --cg-radius-xs:   14px;
  --cg-radius-sm:   20px;
  --cg-radius-md:   26px;
  --cg-radius-lg:   34px;
  --cg-radius-xl:   42px;
  --cg-radius-full: 9999px;

  /* ── Spacing: generous, bouncy ── */
  --cg-sp-2: 12px;
  --cg-sp-3: 18px;
  --cg-sp-4: 24px;
  --cg-sp-5: 32px;
  --cg-sp-6: 44px;

  /* ── Component overrides ── */
  --cg-card-bg:      var(--cg-color-surface-bright);
  --cg-card-radius:  var(--cg-radius-xl);
  --cg-card-padding: var(--cg-sp-5);
  --cg-btn-radius:   var(--cg-radius-full);
  --cg-divider-color: var(--cg-color-outline-variant);
  --cg-divider-thickness: 3px;

  /* ── Elevation: playful candy-colored glow ── */
  --cg-elevation-1: 0 3px 10px rgba(255, 51, 153, 0.12);
  --cg-elevation-2: 0 6px 20px rgba(255, 51, 153, 0.18);
  --cg-elevation-3: 0 10px 36px rgba(255, 51, 153, 0.24);

  /* ── Expressive ── */
  --cg-border-style:       dashed;
  --cg-border-width:       2px;
  --cg-heading-transform:  none;
  --cg-heading-font-style: normal;
  --cg-img-radius:    var(--cg-radius-xl);
  --cg-img-border:    3px dashed var(--cg-color-primary);
  --cg-img-shadow:    var(--cg-elevation-2);
  --cg-img-filter:    saturate(1.3);
  --cg-list-marker-type:   '❤ ';
  --cg-list-marker-color:  var(--cg-color-tertiary);
  --cg-divider-style:      dashed;
  --cg-hover-scale:        1.05;
  --cg-hover-brightness:   1.1;

  /* ── Layout ── */
  --cg-content-max-width:  560px;
  --cg-content-padding:    var(--cg-sp-6);
  --cg-section-spacing:    var(--cg-sp-10);
}`,
  },
  {
    id: "storybook",
    name: "Storybook",
    icon: "📖",
    css: `:root {
  /* ── Surfaces: warm parchment/vellum ── */
  --cg-color-surface-dim:      #e8dcc8;
  --cg-color-surface:          #faf3e6;
  --cg-color-surface-bright:   #fef9f0;
  --cg-color-surface-container-lowest:  #fef9f0;
  --cg-color-surface-container-low:     #f5ecda;
  --cg-color-surface-container:         #eee3cc;
  --cg-color-surface-container-high:    #e4d8be;
  --cg-color-surface-container-highest: #d8cab0;

  /* ── Text: storybook brown-black ── */
  --cg-color-on-surface:       #2c1810;
  --cg-color-on-surface-muted: #8a6e58;

  /* ── Primary: enchanted forest green ── */
  --cg-color-primary:          #3a7c50;
  --cg-color-primary-container:#d4eddc;
  --cg-color-on-primary:       #ffffff;
  --cg-color-on-primary-container: #1a4a28;

  /* ── Secondary: fairy-tale gold ── */
  --cg-color-secondary:        #c4982a;
  --cg-color-secondary-container: #fdf0c8;
  --cg-color-on-secondary:     #2c1810;
  --cg-color-on-secondary-container: #7a5c10;

  /* ── Tertiary: storybook red ── */
  --cg-color-tertiary:         #c04040;
  --cg-color-tertiary-container: #fce0e0;
  --cg-color-on-tertiary:      #ffffff;
  --cg-color-on-tertiary-container: #7a1818;

  /* ── Error ── */
  --cg-color-error:            #b82020;
  --cg-color-error-container:  #fde0d8;
  --cg-color-on-error:         #ffffff;
  --cg-color-on-error-container: #6e0c08;

  /* ── Borders: soft pencil lines ── */
  --cg-color-outline:          #c0b098;
  --cg-color-outline-variant:  #dcd0b8;

  /* ── Skeleton ── */
  --cg-skeleton-bg:    #e4d8be;
  --cg-skeleton-shine: #d8cab0;

  /* ── Typography: warm serif, generous line height ── */
  --cg-font-sans: 'Lora', 'Georgia', serif;
  --cg-text-body-md-size: 16px;
  --cg-text-body-md-line-height: 28px;
  --cg-text-headline-lg-size: 32px;
  --cg-text-headline-lg-line-height: 42px;
  --cg-text-headline-lg-weight: 700;
  --cg-text-headline-md-weight: 600;
  --cg-text-title-md-weight: 600;

  /* ── Radius: gentle, rounded — like picture book panels ── */
  --cg-radius-xs:   6px;
  --cg-radius-sm:   10px;
  --cg-radius-md:   14px;
  --cg-radius-lg:   20px;
  --cg-radius-xl:   28px;
  --cg-radius-full: 9999px;

  /* ── Spacing: cozy, page-like ── */
  --cg-sp-2: 10px;
  --cg-sp-3: 16px;
  --cg-sp-4: 22px;
  --cg-sp-5: 30px;
  --cg-sp-6: 40px;

  /* ── Component overrides ── */
  --cg-card-bg:      var(--cg-color-surface-bright);
  --cg-card-radius:  var(--cg-radius-lg);
  --cg-card-padding: var(--cg-sp-5);
  --cg-card-shadow:  var(--cg-elevation-2);
  --cg-btn-radius:   var(--cg-radius-md);
  --cg-divider-color: var(--cg-color-outline-variant);
  --cg-divider-thickness: 1px;

  /* ── Elevation: soft watercolor wash ── */
  --cg-elevation-1: 0 2px 8px rgba(44, 24, 16, 0.06);
  --cg-elevation-2: 0 4px 16px rgba(44, 24, 16, 0.10);
  --cg-elevation-3: 0 8px 28px rgba(44, 24, 16, 0.14);

  /* ── Expressive ── */
  --cg-border-style:       dashed;
  --cg-border-width:       1px;
  --cg-heading-transform:  none;
  --cg-heading-letter-spacing: 0.02em;
  --cg-heading-font-style: italic;
  --cg-img-radius:    var(--cg-radius-lg);
  --cg-img-border:    2px solid var(--cg-color-outline-variant);
  --cg-img-shadow:    var(--cg-elevation-2);
  --cg-img-filter:    sepia(0.2) brightness(1.05);
  --cg-list-marker-type:   '• ';
  --cg-list-marker-color:  var(--cg-color-secondary);
  --cg-divider-style:      dashed;
  --cg-hover-scale:        1.02;
  --cg-hover-brightness:   1.03;

  /* ── Layout ── */
  --cg-layout-columns:     1;
  --cg-content-max-width:  520px;
  --cg-content-padding:    var(--cg-sp-8);
  --cg-section-spacing:    var(--cg-sp-10);
  --cg-card-direction:     column;
  --cg-media-aspect-ratio: 4/3;
}`,
  },
];
