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
import { colorsLight } from "../../../../styles/host/colors-light";
import { type } from "../../../../styles/host/type";
import { sharedStyles } from "../shared-styles";

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
          <a
            target="_blank"
            href=${link.uri}
            class="sans-flex w-500 round md-body-small"
            ><img
              src="https://www.google.com/s2/favicons?domain=${link.title}&sz=48"
            /><span>${link.title}</span
            ><span class="g-icon inline filled round">open_in_new</span></a
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

      ul {
        list-style: none;
        padding: var(--bb-grid-size-2);
        margin: 0;

        & li {
          display: flex;
          align-items: center;
          margin-bottom: var(--bb-grid-size-2);

          a {
            color: var(--n-0);
            display: flex;
            align-items: center;
          }

          & .g-icon {
            margin-left: var(--bb-grid-size-2);
          }

          img {
            width: 20px;
            height: 20px;
            object-fit: cover;
            border-radius: 50%;
            margin-right: var(--bb-grid-size-2);
            border: 1px solid var(--n-90);
          }
        }
      }
    `,
  ];

  render() {
    const links = this.#links;
    if (!ok(links)) {
      console.warn(links.$error);
      return nothing;
    }

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
