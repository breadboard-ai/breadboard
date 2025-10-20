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
import { provide } from "@lit/context";
import { theme as uiTheme } from "../../../a2ui-theme/a2ui-theme.js";

@customElement("bb-particle-view")
export class ParticleView extends SignalWatcher(LitElement) {
  @provide({ context: v0_8.UI.Context.themeContext })
  accessor theme: v0_8.Types.Theme = uiTheme;

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
      const body = (this.particle as GroupParticle).group.get(
        "body"
      ) as TextParticle;
      if (!body) {
        console.warn('No body in "a2ui" particle');
        return nothing;
      }
      const { text } = body;
      let messages = parseJson(text);
      if (!ok(messages)) {
        console.warn("Failed to parse JSON of the payload");
        return nothing;
      }

      if (!Array.isArray(messages)) {
        messages = [messages];
      }

      const processor = new v0_8.Data.A2UIModelProcessor();
      processor.clearSurfaces();
      processor.processMessages(messages);

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
