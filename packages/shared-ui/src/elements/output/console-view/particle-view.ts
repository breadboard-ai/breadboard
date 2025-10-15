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
import { html, SignalWatcher } from "@lit-labs/signals";
import { LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { signal } from "signal-utils";
import { v0_8 } from "@breadboard-ai/a2ui";
import { err, ok } from "@breadboard-ai/utils";
import { repeat } from "lit/directives/repeat.js";

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
    } else if (type === "a2ui") {
      const processor = new v0_8.Data.A2UIModelProcessor();
      const body = (this.particle as GroupParticle).group.get(
        "body"
      ) as TextParticle;
      if (!body) {
        console.warn('No body in "a2ui" particle');
        return nothing;
      }
      const { text } = body;
      const surfaceUpdate = parseJson(text);
      if (!ok(surfaceUpdate)) {
        console.warn("Failed to parse JSON of the payload");
        return nothing;
      }

      processor.processMessages([
        {
          surfaceUpdate,
        },
      ]);
      return html`<section id="surfaces">
        ${repeat(
          processor.getSurfaces(),
          ([surfaceId]) => surfaceId,
          ([surfaceId, surface]) => {
            return html`<a2ui-surface
              .surfaceId=${surfaceId}
              .surface=${surface}
              .processor=${processor}
            ></a2-uisurface>`;
          }
        )}
      </section>`;
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
