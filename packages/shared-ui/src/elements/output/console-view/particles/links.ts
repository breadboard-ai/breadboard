/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GroupParticle,
  Particle,
  TextParticle,
} from "@breadboard-ai/particles";
import { err, ok, Outcome } from "@google-labs/breadboard";
import { html, SignalWatcher } from "@lit-labs/signals";
import { css, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { signal } from "signal-utils";

import { icons } from "../../../../styles/icons";
import { sharedStyles } from "./../shared-styles";
import { colorsLight } from "../../../../styles/host/colors-light";
import { type } from "../../../../styles/host/type";

type Link = {
  uri: string;
  title: string;
};

@customElement("bb-particle-links")
export class ParticleLinks extends SignalWatcher(LitElement) {
  @property()
  accessor particle: Particle | null = null;

  @signal
  get #group(): Map<string, Particle> | null {
    return (this.particle as GroupParticle)?.group || null;
  }

  @signal
  get #title(): string | typeof nothing {
    return (this.#group?.get("title") as TextParticle)?.text || nothing;
  }

  @signal
  get #icon(): string {
    return (this.#group?.get("icon") as TextParticle)?.text || "info";
  }

  @signal
  get #links(): Outcome<TemplateResult> {
    const { text, mimeType } = this.#group?.get("links") as TextParticle;

    if (!text) {
      return err(`No "links" found in "links" particle`);
    }

    if (mimeType !== "application/json") {
      return err(
        `The "links" particle expected "application/json", got "${mimeType} instead`
      );
    }

    const value = parseJson(text) as Link[];
    if (!value || !Array.isArray(value)) {
      return err(`Expected array of links, got this instead: ${text}`);
    }
    return html`<ul>
      ${value.map((link) => {
        return html`<li>
          <a href="${link.uri}"
            ><img
              src="https://www.google.com/s2/favicons?domain=${link.title}&sz=48"
            /><span>${link.title}</span></a
          >
        </li>`;
      })}
    </ul>`;
  }

  static styles = [
    icons,
    sharedStyles,
    colorsLight,
    type,
    css`
      :host {
        display: block;
      }
    `,
  ];

  render() {
    const links = this.#links;
    if (!ok(links)) {
      console.warn(links.$error);
      return nothing;
    }

    // In the future, this is likely its own element that operates on a
    // particle.
    // It is instantiated by ParticleView based on type = "update".
    return html` <div class="output" data-label=${this.#title}>
      <span class="g-icon filled round">${this.#icon}</span>
      ${links}
    </div>`;
  }
}

function parseJson(s: string) {
  try {
    return JSON.parse(s);
  } catch (e) {
    const error = (e as Error).message;
    console.warn("Failed to parse Particle body", error);
    return err(error);
  }
}
