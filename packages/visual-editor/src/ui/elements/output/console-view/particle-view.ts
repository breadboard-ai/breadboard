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
import * as A2UI from "@breadboard-ai/a2ui/ui";
import { err, ok } from "@breadboard-ai/utils";
import { repeat } from "lit/directives/repeat.js";
import { provide } from "@lit/context";
import { theme as uiTheme } from "../../../a2ui-theme/a2ui-theme.js";

@customElement("bb-particle-view")
export class ParticleView extends SignalWatcher(LitElement) {
  @provide({ context: A2UI.Context.themeContext })
  accessor theme: v0_8.Types.Theme = uiTheme;

  @property()
  accessor particle: Particle | null = null;

  @signal
  get #type(): string | null {
    return (this.particle as GroupParticle)?.type || null;
  }

  #processor = new v0_8.Data.A2UIModelProcessor();

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

      this.#processor.processMessages(messages);

      console.log("A2UI Processor");
      console.log(messages, this.#processor.getSurfaces());

      return html`<section id="surfaces">
        ${repeat(
          this.#processor.getSurfaces(),
          ([surfaceId]) => surfaceId,
          ([surfaceId, surface]) => {
            return html`<a2ui-surface
              .surfaceId=${surfaceId}
              .surface=${surface}
              .processor=${this.#processor}
              @a2uiaction=${async (
                evt: v0_8.Events.StateEvent<"a2ui.action">
              ) => {
                const [target] = evt.composedPath();
                if (!(target instanceof HTMLElement)) {
                  return;
                }

                const context: Record<string, unknown> = {};
                if (evt.detail.action.context) {
                  const srcContext = evt.detail.action.context;
                  for (const item of srcContext) {
                    if (item.value.literalBoolean) {
                      context[item.key] = item.value.literalBoolean;
                    } else if (item.value.literalNumber) {
                      context[item.key] = item.value.literalNumber;
                    } else if (item.value.literalString) {
                      context[item.key] = item.value.literalString;
                    } else if (item.value.path) {
                      if (!evt.detail.sourceComponent) {
                        throw new Error(
                          "No component provided - unable to get data"
                        );
                      }
                      const path = this.#processor.resolvePath(
                        item.value.path,
                        evt.detail.dataContextPath
                      );
                      const value = this.#processor.getData(
                        evt.detail.sourceComponent,
                        path,
                        surfaceId
                      );
                      context[item.key] = value ?? "";
                    }
                  }
                }

                const message: v0_8.Types.A2UIClientEventMessage = {
                  userAction: {
                    name: evt.detail.action.name,
                    surfaceId,
                    sourceComponentId: target.id,
                    timestamp: new Date().toISOString(),
                    context,
                  },
                };

                // TODO: Phone home.
                console.log("A2UI message", message);
                // debugger;
              }}
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
