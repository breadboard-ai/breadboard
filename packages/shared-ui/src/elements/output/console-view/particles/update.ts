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

@customElement("bb-particle-update")
export class ParticleUpdate extends SignalWatcher(LitElement) {
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
  get #body(): Outcome<TemplateResult> {
    const { text, mimeType = "text/markdown" } = this.#group?.get(
      "body"
    ) as TextParticle;

    if (!text) {
      return err(`No "body" found in "update" particle`);
    }

    let value;
    if (mimeType === "application/json") {
      const parsed = parseJson(text);
      if (!parsed) return parsed;
      value = html`<bb-json-tree .json=${parsed}></bb-json-tree>`;
    } else if (mimeType == "application/vnd.breadboard.llm-content") {
      const parsed = parseJson(text);
      if (!parsed) return parsed;
      // The mimeType here is a kludge. Instead, we should be sending
      // a particle group that represents LLM Content and then convert them
      // here to LLM Content to pass to `bb-llm-output`.
      // And in the future, `bb-llm-content` is just a ParticleView.
      value = html`<bb-llm-output
        .lite=${true}
        .clamped=${false}
        .value=${parsed}
      ></bb-llm-output>`;
    } else if (mimeType?.startsWith("text/")) {
      // This is also a kludge. I only need the "render markdown nicely" part
      // of llm-output.
      value = html`<bb-llm-output
        .lite=${true}
        .clamped=${false}
        .value=${{ parts: [{ text }] }}
      ></bb-llm-output>`;
    } else {
      return err(`Unrecognized mimeType: "${mimeType}"`);
    }
    return value;
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
    const body = this.#body;
    if (!ok(body)) {
      console.warn(body.$error);
      return nothing;
    }

    return html` <div class="output" data-label=${this.#title}>
      <span class="g-icon filled round">${this.#icon}</span>
      ${body}
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
