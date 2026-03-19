/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Theme definitions — each theme provides:
 * - A prompt supplement that steers the model's visual language
 * - CSS variable overrides applied to the iframe's :root
 */

export { themes, themeNames, getThemePrompt, getThemeCss, UNIVERSAL_GUIDANCE };
export type { Theme, ThemeName };

interface Theme {
  /** Display name shown in the UI. */
  label: string;
  /** Prompt text appended to the skill to steer visual direction. */
  prompt: string;
  /** CSS custom property overrides applied to iframe :root. */
  vars: Record<string, string>;
}

type ThemeName =
  | "editorial"
  | "modern"
  | "brutalist"
  | "neon"
  | "eighties"
  | "swiss";

const themeNames: ThemeName[] = [
  "editorial",
  "modern",
  "brutalist",
  "neon",
  "eighties",
  "swiss",
];

/**
 * Universal guidance appended to every theme prompt:
 * responsive design + token discipline.
 */
const UNIVERSAL_GUIDANCE =
  "\n\n## Responsive Design\n" +
  "The layout MUST be fully responsive from 320px to 1400px. " +
  "Use CSS clamp() for font sizes and spacing. Use flex-wrap or CSS grid with " +
  "auto-fit/minmax for multi-column layouts. Test your mental model at 375px " +
  "(phone), 768px (tablet), and 1200px (desktop). Avoid fixed widths. " +
  "Columns should stack on narrow viewports. Images should be max-width: 100%." +
  "\n\n## Token Discipline\n" +
  "ALWAYS use --cg-* CSS custom properties instead of hardcoded values. " +
  "The design tokens can be overridden by themes, so if you hardcode colors, " +
  "radii, shadows, or fonts, theme switching will not work.\n\n" +
  "- Colors: use var(--cg-color-surface), var(--cg-color-on-surface), " +
  "var(--cg-color-primary), etc. Never hardcode hex values.\n" +
  "- Border radius: use var(--cg-radius-sm), var(--cg-radius-md), " +
  "var(--cg-radius-lg), etc. Never hardcode px.\n" +
  "- Spacing: use var(--cg-sp-1) through var(--cg-sp-16) for margins " +
  "and padding. Never hardcode spacing values.\n" +
  "- Shadows: use var(--cg-elevation-1/2/3). Never hardcode box-shadow.\n" +
  "- Fonts: use var(--cg-font-sans) and var(--cg-font-mono). " +
  "Never hardcode font-family.\n" +
  "- Typography: use var(--cg-text-*-size), var(--cg-text-*-line-height), " +
  "var(--cg-text-*-weight) for text sizing.\n" +
  "This is non-negotiable. Every visual property that has a --cg-* token " +
  "MUST use that token.";

const themes: Record<ThemeName, Theme> = {
  editorial: {
    label: "Editorial",
    prompt:
      "Design in an editorial magazine style with high-end art direction: " +
      "warm cream backgrounds, serif headlines, generous whitespace, text overlapping " +
      "full-bleed images, pull quotes in large italic serif, asymmetric columns, " +
      "oversized typography, and a confident, unhurried pace. " +
      "The palette is warm neutrals — cream, charcoal, dusty rose accents.",
    vars: {
      // Default token set — no overrides needed
    },
  },

  modern: {
    label: "Modern",
    prompt:
      "Design in a clean, contemporary style. Minimal and precise: " +
      "crisp white backgrounds, tight sans-serif typography, " +
      "subtle gray borders, precise spacing, gentle frosted-glass effects, " +
      "restrained color — mostly monochrome with a single accent color. " +
      "Rounded corners, quiet shadows, and micro-animations. " +
      "Information density is medium. Everything feels precise and intentional.",
    vars: {
      "--cg-color-surface": "#ffffff",
      "--cg-color-surface-dim": "#f2f2f7",
      "--cg-color-surface-container": "#f5f5f7",
      "--cg-color-surface-container-high": "#e8e8ed",
      "--cg-color-surface-container-highest": "#d1d1d6",
      "--cg-color-on-surface": "#1d1d1f",
      "--cg-color-on-surface-muted": "#86868b",
      "--cg-color-primary": "#0071e3",
      "--cg-color-primary-container": "#e3f2fd",
      "--cg-color-on-primary": "#ffffff",
      "--cg-color-on-primary-container": "#003a75",
      "--cg-color-secondary": "#86868b",
      "--cg-color-secondary-container": "#f2f2f7",
      "--cg-color-outline": "#d1d1d6",
      "--cg-color-outline-variant": "#e8e8ed",
      "--cg-img-shadow": "0 2px 12px rgba(0, 0, 0, 0.08)",
      "--cg-hover-brightness": "1.02",
    },
  },

  brutalist: {
    label: "Brutalist",
    prompt:
      "Design in a brutalist web style. Raw, unpolished, confrontational: " +
      "black and white with occasional red or " +
      "yellow accents. Monospace or industrial typefaces. Thick black borders, " +
      "no border-radius, no shadows, no gradients. Elements overlap deliberately. " +
      "Dense text blocks. Oversized counters and labels. Grid lines visible. " +
      "Nothing is decorative — everything earns its place through information density.",
    vars: {
      "--cg-color-surface": "#ffffff",
      "--cg-color-surface-dim": "#e0e0e0",
      "--cg-color-surface-container": "#f0f0f0",
      "--cg-color-surface-container-high": "#e0e0e0",
      "--cg-color-surface-container-highest": "#cccccc",
      "--cg-color-on-surface": "#000000",
      "--cg-color-on-surface-muted": "#555555",
      "--cg-color-primary": "#ff0000",
      "--cg-color-primary-container": "#ffe0e0",
      "--cg-color-on-primary": "#ffffff",
      "--cg-color-on-primary-container": "#800000",
      "--cg-color-secondary": "#000000",
      "--cg-color-secondary-container": "#e0e0e0",
      "--cg-color-outline": "#000000",
      "--cg-color-outline-variant": "#cccccc",
      "--cg-font-serif": "'Courier New', Courier, monospace",
      "--cg-radius-xs": "0px",
      "--cg-radius-sm": "0px",
      "--cg-radius-md": "0px",
      "--cg-radius-lg": "0px",
      "--cg-radius-xl": "0px",
      "--cg-radius-full": "0px",
      "--cg-elevation-1": "none",
      "--cg-elevation-2": "none",
      "--cg-elevation-3": "none",
      "--cg-border-width": "3px",
      "--cg-heading-transform": "uppercase",
      "--cg-heading-letter-spacing": "0.08em",
      "--cg-img-radius": "0px",
      "--cg-img-border": "3px solid #000000",
      "--cg-divider-thickness": "3px",
      "--cg-divider-color": "#000000",
      "--cg-hover-scale": "1",
      "--cg-hover-shadow": "none",
    },
  },

  neon: {
    label: "Neon",
    prompt:
      "Design in a dark-mode neon/cyberpunk style. Sci-fi terminal aesthetic: " +
      "deep black or very dark blue-black background (#0a0a0f), electric cyan " +
      "and hot pink accents, neon glow effects (box-shadow with color spread). " +
      "Monospace or geometric sans-serif typography. Thin glowing borders. " +
      "Elements feel like they're floating on a dark void. Subtle scanline or " +
      "grid effects. Data feels like it's being projected. Use text-shadow for " +
      "glow effects on headings.",
    vars: {
      "--cg-color-surface": "#0a0a0f",
      "--cg-color-surface-dim": "#050508",
      "--cg-color-surface-bright": "#1a1a2e",
      "--cg-color-surface-container-lowest": "#0d0d12",
      "--cg-color-surface-container-low": "#12121a",
      "--cg-color-surface-container": "#1a1a2e",
      "--cg-color-surface-container-high": "#222240",
      "--cg-color-surface-container-highest": "#2a2a4a",
      "--cg-color-on-surface": "#e0e0ff",
      "--cg-color-on-surface-muted": "#7a7a9a",
      "--cg-color-primary": "#00ffff",
      "--cg-color-primary-container": "#003333",
      "--cg-color-on-primary": "#000000",
      "--cg-color-on-primary-container": "#00ffff",
      "--cg-color-secondary": "#ff00ff",
      "--cg-color-secondary-container": "#330033",
      "--cg-color-on-secondary": "#000000",
      "--cg-color-on-secondary-container": "#ff00ff",
      "--cg-color-tertiary": "#00ff88",
      "--cg-color-tertiary-container": "#003320",
      "--cg-color-outline": "#333355",
      "--cg-color-outline-variant": "#222244",
      "--cg-font-serif": "var(--cg-font-mono)",
      "--cg-card-bg": "#12121a",
      "--cg-card-shadow":
        "0 0 12px rgba(0, 255, 255, 0.15), 0 0 4px rgba(0, 255, 255, 0.1)",
      "--cg-border-style": "solid",
      "--cg-border-width": "1px",
      "--cg-heading-letter-spacing": "0.12em",
      "--cg-heading-transform": "uppercase",
      "--cg-img-radius": "var(--cg-radius-sm)",
      "--cg-img-border": "1px solid rgba(0, 255, 255, 0.2)",
      "--cg-img-shadow": "0 0 20px rgba(0, 255, 255, 0.1)",
      "--cg-divider-color": "rgba(0, 255, 255, 0.2)",
      "--cg-hover-brightness": "1.15",
      "--cg-hover-shadow":
        "0 0 16px rgba(0, 255, 255, 0.25)",
    },
  },

  eighties: {
    label: "80s",
    prompt:
      "Design in a 1980s retro style. Sunset-era nostalgia: " +
      "warm sunset gradients (peach → coral → magenta), palm-shadow patterns, " +
      "chunky geometric shapes, chrome or metallic text effects. " +
      "Bold sans-serif typography, often italicized. Horizontal pinstripes. " +
      "Colors are saturated but warm — no neon coldness. Pastel pink, " +
      "turquoise, coral, lavender. Grid-based but with diagonal accents. " +
      "Drop shadows are intentionally heavy, not subtle.",
    vars: {
      "--cg-color-surface": "#fce4ec",
      "--cg-color-surface-dim": "#f8bbd0",
      "--cg-color-surface-bright": "#fff3e0",
      "--cg-color-surface-container-lowest": "#fff8e1",
      "--cg-color-surface-container-low": "#fce4ec",
      "--cg-color-surface-container": "#f8bbd0",
      "--cg-color-surface-container-high": "#f48fb1",
      "--cg-color-surface-container-highest": "#ec407a",
      "--cg-color-on-surface": "#311b3f",
      "--cg-color-on-surface-muted": "#6d4c7a",
      "--cg-color-primary": "#e91e63",
      "--cg-color-primary-container": "#fce4ec",
      "--cg-color-on-primary": "#ffffff",
      "--cg-color-on-primary-container": "#880e4f",
      "--cg-color-secondary": "#00bcd4",
      "--cg-color-secondary-container": "#e0f7fa",
      "--cg-color-on-secondary": "#ffffff",
      "--cg-color-tertiary": "#ff9800",
      "--cg-color-outline": "#ce93d8",
      "--cg-color-outline-variant": "#f3e5f5",
      "--cg-elevation-1":
        "4px 4px 0 rgba(49, 27, 63, 0.15)",
      "--cg-elevation-2":
        "6px 6px 0 rgba(49, 27, 63, 0.2)",
      "--cg-elevation-3":
        "8px 8px 0 rgba(49, 27, 63, 0.25)",
      "--cg-heading-font-style": "italic",
      "--cg-heading-letter-spacing": "0.03em",
      "--cg-img-filter": "saturate(1.2) contrast(1.05)",
      "--cg-img-shadow": "6px 6px 0 rgba(49, 27, 63, 0.15)",
      "--cg-divider-color": "var(--cg-color-outline)",
      "--cg-divider-style": "dashed",
      "--cg-hover-scale": "1.03",
    },
  },

  swiss: {
    label: "Swiss",
    prompt:
      "Design in the International Typographic Style (Swiss Design). " +
      "Strict grid, grotesque sans-serif typeface, " +
      "asymmetric but mathematically precise layouts. Limited color — mostly black, " +
      "white, and one accent (red or blue). Large empty space is intentional. " +
      "Photography is documentary-style, full bleed, used as texture not illustration. " +
      "No decorative elements. Type is the design. Flush-left, ragged-right. " +
      "Information hierarchy through weight and scale, never through decoration.",
    vars: {
      "--cg-color-surface": "#ffffff",
      "--cg-color-surface-dim": "#f0f0f0",
      "--cg-color-surface-container": "#f5f5f5",
      "--cg-color-surface-container-high": "#eeeeee",
      "--cg-color-surface-container-highest": "#e0e0e0",
      "--cg-color-on-surface": "#000000",
      "--cg-color-on-surface-muted": "#666666",
      "--cg-color-primary": "#e53935",
      "--cg-color-primary-container": "#ffebee",
      "--cg-color-on-primary": "#ffffff",
      "--cg-color-on-primary-container": "#b71c1c",
      "--cg-color-secondary": "#000000",
      "--cg-color-secondary-container": "#f5f5f5",
      "--cg-color-outline": "#000000",
      "--cg-color-outline-variant": "#e0e0e0",
      "--cg-font-sans": "'Helvetica Neue', Helvetica, Arial, sans-serif",
      "--cg-font-serif": "'Helvetica Neue', Helvetica, Arial, sans-serif",
      "--cg-radius-xs": "0px",
      "--cg-radius-sm": "0px",
      "--cg-radius-md": "0px",
      "--cg-radius-lg": "0px",
      "--cg-radius-xl": "0px",
      "--cg-radius-full": "0px",
      "--cg-heading-transform": "uppercase",
      "--cg-heading-letter-spacing": "0.05em",
      "--cg-img-radius": "0px",
      "--cg-divider-color": "#000000",
      "--cg-divider-thickness": "2px",
      "--cg-hover-scale": "1",
      "--cg-hover-shadow": "none",
    },
  },
};

/** Returns the full prompt text for a theme, including responsive guidance. */
function getThemePrompt(name: ThemeName): string {
  return themes[name].prompt + UNIVERSAL_GUIDANCE;
}

/** Returns a CSS string of :root overrides for a theme. Empty for editorial. */
function getThemeCss(name: ThemeName): string {
  const vars = themes[name].vars;
  const entries = Object.entries(vars);
  if (entries.length === 0) return "";
  const declarations = entries.map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `:root {\n${declarations}\n}`;
}
