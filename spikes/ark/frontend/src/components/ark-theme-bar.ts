/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

export { ArkThemeBar, THEMES, type Theme };

interface Theme {
  id: string;
  name: string;
  icon: string;
  css: string;
}

/**
 * The 6 themes ported from the Component Generator.
 *
 * Each theme overrides --cg- design tokens. The "midnight" theme uses the
 * base token values (empty CSS = no overrides).
 */
const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    icon: "🌙",
    css: `:root{--cg-color-surface-dim:#0a0a0a;--cg-color-surface:#121212;--cg-color-surface-bright:#1e1e1e;--cg-color-surface-container-lowest:#0e0e0e;--cg-color-surface-container-low:#1a1a1a;--cg-color-surface-container:#222;--cg-color-surface-container-high:#2a2a2a;--cg-color-surface-container-highest:#333;--cg-color-on-surface:#f0f0f0;--cg-color-on-surface-muted:#8a8a8a;--cg-color-primary:#a3e635;--cg-color-primary-container:#1a2e05;--cg-color-on-primary:#0a0a0a;--cg-color-on-primary-container:#d9f99d;--cg-color-secondary:#60a5fa;--cg-color-secondary-container:#0c2d6b;--cg-color-on-secondary:#0a0a0a;--cg-color-on-secondary-container:#bfdbfe;--cg-color-tertiary:#fbbf24;--cg-color-tertiary-container:#451a03;--cg-color-on-tertiary:#0a0a0a;--cg-color-on-tertiary-container:#fef3c7;--cg-color-error:#ef4444;--cg-color-error-container:#450a0a;--cg-color-on-error:#0a0a0a;--cg-color-on-error-container:#fecaca;--cg-color-outline:#404040;--cg-color-outline-variant:#2a2a2a}`,
  },
  {
    id: "editorial",
    name: "Editorial",
    icon: "📰",
    css: `:root{--cg-color-surface-dim:#e0d8c8;--cg-color-surface:#f8f4eb;--cg-color-surface-bright:#fffdf7;--cg-color-surface-container-lowest:#fffdf7;--cg-color-surface-container-low:#f2ecdf;--cg-color-surface-container:#e8e0d0;--cg-color-surface-container-high:#ddd4c2;--cg-color-surface-container-highest:#d0c7b4;--cg-color-on-surface:#1a1008;--cg-color-on-surface-muted:#7a6e5a;--cg-color-primary:#2d5e3f;--cg-color-primary-container:#d4eadb;--cg-color-on-primary:#fff;--cg-color-on-primary-container:#0f3520;--cg-color-outline:#b0a890;--cg-color-outline-variant:#d0c8b0;--cg-font-sans:'Playfair Display','Georgia',serif;--cg-radius-xs:0;--cg-radius-sm:2px;--cg-radius-md:3px;--cg-radius-lg:4px;--cg-radius-xl:6px;--cg-card-bg:var(--cg-color-surface-bright);--cg-card-radius:0;--cg-card-shadow:none;--cg-heading-transform:uppercase;--cg-heading-letter-spacing:.04em;--cg-img-radius:0;--cg-img-shadow:none;--cg-img-filter:sepia(.15);--cg-divider-style:double;--cg-divider-thickness:2px}`,
  },
  {
    id: "ocean",
    name: "Ocean",
    icon: "🌊",
    css: `:root{--cg-color-surface-dim:#040c18;--cg-color-surface:#081428;--cg-color-surface-bright:#101e38;--cg-color-surface-container-lowest:#060e1e;--cg-color-surface-container-low:#0c1a30;--cg-color-surface-container:#122548;--cg-color-surface-container-high:#1a3060;--cg-color-surface-container-highest:#244078;--cg-color-on-surface:#d0e4ff;--cg-color-on-surface-muted:#5a80b0;--cg-color-primary:#00e5ff;--cg-color-primary-container:#042838;--cg-color-on-primary:#041020;--cg-color-on-primary-container:#80f0ff;--cg-color-secondary:#ff4ec4;--cg-color-secondary-container:#300828;--cg-color-tertiary:#eeff41;--cg-color-outline:#1a3060;--cg-color-outline-variant:#122548;--cg-radius-xs:8px;--cg-radius-sm:16px;--cg-radius-md:24px;--cg-radius-lg:32px;--cg-radius-xl:40px;--cg-elevation-1:0 0 12px rgba(0,229,255,.08);--cg-elevation-2:0 0 24px rgba(0,229,255,.12);--cg-heading-transform:uppercase;--cg-heading-letter-spacing:.06em;--cg-img-radius:var(--cg-radius-full);--cg-img-border:2px solid var(--cg-color-primary);--cg-img-shadow:0 0 20px rgba(0,229,255,.25);--cg-hover-scale:1.03}`,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    icon: "🏗️",
    css: `:root{--cg-color-surface:#fff;--cg-color-surface-bright:#fff;--cg-color-surface-dim:#e0e0e0;--cg-color-surface-container-lowest:#fff;--cg-color-surface-container-low:#f5f5f5;--cg-color-surface-container:#eee;--cg-color-surface-container-high:#e0e0e0;--cg-color-surface-container-highest:#ccc;--cg-color-on-surface:#000;--cg-color-on-surface-muted:#555;--cg-color-primary:#f00;--cg-color-primary-container:#ffe0e0;--cg-color-on-primary:#fff;--cg-color-outline:#000;--cg-color-outline-variant:#333;--cg-font-sans:'JetBrains Mono','Courier New',monospace;--cg-radius-xs:0;--cg-radius-sm:0;--cg-radius-md:0;--cg-radius-lg:0;--cg-radius-xl:0;--cg-radius-full:0;--cg-elevation-1:none;--cg-elevation-2:none;--cg-elevation-3:none;--cg-card-bg:#fff;--cg-card-radius:0;--cg-card-shadow:none;--cg-border-style:double;--cg-border-width:3px;--cg-heading-transform:uppercase;--cg-heading-letter-spacing:.1em;--cg-img-radius:0;--cg-img-border:3px solid #000;--cg-img-shadow:none;--cg-img-filter:grayscale(1) contrast(1.2);--cg-divider-color:#000;--cg-divider-thickness:3px;--cg-divider-style:double}`,
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    icon: "🫧",
    css: `:root{--cg-color-surface-dim:#ffe0f0;--cg-color-surface:#fff5fa;--cg-color-surface-bright:#fffafd;--cg-color-surface-container-lowest:#fffafd;--cg-color-surface-container-low:#fff0f6;--cg-color-surface-container:#ffe4ef;--cg-color-surface-container-high:#ffd6e8;--cg-color-surface-container-highest:#ffc8e0;--cg-color-on-surface:#3e1050;--cg-color-on-surface-muted:#9e5880;--cg-color-primary:#f39;--cg-color-primary-container:#ffe0f0;--cg-color-on-primary:#fff;--cg-color-secondary:#76ff03;--cg-color-tertiary:#00b0ff;--cg-color-outline:#f0a0c0;--cg-color-outline-variant:#ffd0e4;--cg-font-sans:'Comic Neue','Comic Sans MS',cursive;--cg-radius-xs:14px;--cg-radius-sm:20px;--cg-radius-md:26px;--cg-radius-lg:34px;--cg-radius-xl:42px;--cg-card-bg:var(--cg-color-surface-bright);--cg-card-radius:var(--cg-radius-xl);--cg-elevation-1:0 3px 10px rgba(255,51,153,.12);--cg-elevation-2:0 6px 20px rgba(255,51,153,.18);--cg-border-style:dashed;--cg-border-width:2px;--cg-img-radius:var(--cg-radius-xl);--cg-img-border:3px dashed var(--cg-color-primary);--cg-hover-scale:1.05;--cg-hover-brightness:1.1}`,
  },
  {
    id: "storybook",
    name: "Storybook",
    icon: "📖",
    css: `:root{--cg-color-surface-dim:#e8dcc8;--cg-color-surface:#faf3e6;--cg-color-surface-bright:#fef9f0;--cg-color-surface-container-lowest:#fef9f0;--cg-color-surface-container-low:#f5ecda;--cg-color-surface-container:#eee3cc;--cg-color-surface-container-high:#e4d8be;--cg-color-surface-container-highest:#d8cab0;--cg-color-on-surface:#2c1810;--cg-color-on-surface-muted:#8a6e58;--cg-color-primary:#3a7c50;--cg-color-primary-container:#d4eddc;--cg-color-on-primary:#fff;--cg-color-secondary:#c4982a;--cg-color-tertiary:#c04040;--cg-color-outline:#c0b098;--cg-color-outline-variant:#dcd0b8;--cg-font-sans:'Lora','Georgia',serif;--cg-radius-xs:6px;--cg-radius-sm:10px;--cg-radius-md:14px;--cg-radius-lg:20px;--cg-radius-xl:28px;--cg-heading-font-style:italic;--cg-heading-letter-spacing:.02em;--cg-img-radius:var(--cg-radius-lg);--cg-img-border:2px solid var(--cg-color-outline-variant);--cg-img-shadow:var(--cg-elevation-2);--cg-img-filter:sepia(.2) brightness(1.05);--cg-border-style:dashed;--cg-divider-style:dashed;--cg-hover-scale:1.02}`,
  },
];

/**
 * Theme bar — a row of theme selector buttons for the component preview.
 *
 * Fires `theme-change` with `{ css: string }` in detail when a theme
 * is selected. The host applies the CSS override to the active iframe.
 */
@customElement("ark-theme-bar")
class ArkThemeBar extends LitElement {
  @state() private activeTheme = "midnight";

  override connectedCallback() {
    super.connectedCallback();
    // Fire initial theme so the iframe gets the default on first load.
    requestAnimationFrame(() => {
      const theme = THEMES.find((t) => t.id === this.activeTheme);
      if (theme) this.#select(theme);
    });
  }

  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 16px;
      background: #1a1a1a;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    label {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.35);
      margin-right: 8px;
      user-select: none;
    }

    button {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 12px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.5);
      font-family: inherit;
      transition:
        border-color 0.15s,
        background 0.15s;
    }

    button:hover {
      border-color: rgba(255, 255, 255, 0.25);
      color: rgba(255, 255, 255, 0.7);
    }

    button[data-active] {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
  `;

  override render() {
    return html`
      <label>Theme</label>
      ${THEMES.map(
        (t) => html`
          <button
            ?data-active=${t.id === this.activeTheme}
            @click=${() => this.#select(t)}
          >
            ${t.icon} ${t.name}
          </button>
        `
      )}
    `;
  }

  #select(theme: Theme) {
    this.activeTheme = theme.id;
    this.dispatchEvent(
      new CustomEvent("theme-change", {
        detail: { css: theme.css },
        bubbles: true,
        composed: true,
      })
    );
  }
}
