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
import { icons } from "../../../styles/icons";
import { sharedStyles } from "./shared-styles";
import { colorsLight } from "../../../styles/host/colors-light";
import { type } from "../../../styles/host/type";

@customElement("bb-particle-view")
export class ParticleView extends SignalWatcher(LitElement) {
  @property()
  accessor particle: Particle | null = null;

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

  // In the future, this is likely its own element that operates on a particle.
  // It is instantiated by ParticleView based on type = "update".
  #renderUpdateGroup(group: Map<string, Particle>): Outcome<TemplateResult> {
    const title = (group.get("title") as TextParticle).text;
    if (!title) {
      return err(`No "title" found in "update" particle`);
    }

    const { text, mimeType } = group.get("body") as TextParticle;

    if (!text) {
      return err(`No "body" found in "update" particle`);
    }
    const parsed = parseJson(text);
    if (!parsed) return parsed;

    let value;
    if (mimeType === "application/json") {
      value = html`<bb-json-tree .json=${parsed}></bb-json-tree>`;
    } else if (mimeType == "application/vnd.breadboard.llm-content") {
      // The mimeType here is a kludge. Instead, we should be sending
      // a particle group that represents LLM Content and then convert them
      // here to LLM Content to pass to `bb-llm-output`.
      // And in the future, `bb-llm-content` is just a ParticleView.
      value = html`<bb-llm-output
        .lite=${true}
        .clamped=${false}
        .value=${parsed}
      ></bb-llm-output>`;
    } else {
      return err(`Unrecognized mimeType: "${mimeType}"`);
    }

    // TODO: Allow the particle to set the icon.
    const icon = "spark";
    return html` <div class="output" data-label=${title}>
      ${icon ? html`<span class="g-icon filled round">${icon}</span>` : nothing}
      ${value}
    </div>`;
  }

  render() {
    if (!this.particle) return nothing;

    // For now, we hard-code support for only `update` GroupParticle.
    // v0, so to say.
    // TODO: Make this extensible
    const { type, group } = this.particle as GroupParticle;

    // Ideally, this is somehow extensible, where `update` is used to
    // load a different Lit element maybe?
    if (type === "update") {
      const updateGroup = this.#renderUpdateGroup(group);
      if (!ok(updateGroup)) {
        console.warn(updateGroup.$error);
        return nothing;
      }

      return updateGroup;
    } else {
      // Here, we could have a graceful fallback and just try to render
      // "generic particle"
      console.warn("Unrecognized particle", this.particle);
      return nothing;
    }
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
