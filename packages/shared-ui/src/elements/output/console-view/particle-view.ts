/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GroupParticle, Particle } from "@breadboard-ai/particles";
import { html, SignalWatcher } from "@lit-labs/signals";
import { LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { signal } from "signal-utils";

@customElement("bb-particle-view")
export class ParticleView extends SignalWatcher(LitElement) {
  @property()
  accessor particle: Particle | null = null;

  @signal
  get #type(): string | null {
    return (this.particle as GroupParticle)?.type || null;
  }

  render() {
    const type = this.#type;
    if (type === "update") {
      return html`<bb-particle-update
        .particle=${this.particle}
      ></bb-particle-update>`;
    } else if (type === "links") {
      return html`<bb-particle-links
        .particle=${this.particle}
      ></bb-particle-links>`;
    } else {
      // Here, we could have a graceful fallback and just try to render
      // "generic particle"
      console.warn("Unrecognized particle", this.particle);
      return nothing;
    }
  }
}
