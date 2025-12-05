/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { themeContext } from "../../context/theme.js";
import * as Styles from "../../styles/index.js";

import "./particle-ui-card.js";
import "../viewers/particle-viewer-image.js";
import "./particle-ui-segment.js";
import {
  extractValue,
  FieldName,
  GroupParticle,
  isGroupParticle,
  Orientation,
  ParticleData,
} from "@breadboard-ai/particles";
import { UITheme } from "../../types/types.js";
import { merge } from "../../utils/utils.js";
import { styleMap } from "lit/directives/style-map.js";

@customElement("particle-ui-list")
export class ParticleUIList extends SignalWatcher(LitElement) {
  @property()
  accessor group: GroupParticle | null = null;

  @property({ reflect: true, type: String })
  accessor orientation: Orientation = "vertical";

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    Styles.all,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
      }

      :host([orientation="vertical"]) {
        #list {
          display: grid;
          grid-auto-rows: auto;
          width: 100%;

          flex-direction: column;
        }
      }

      :host([orientation="horizontal"]) {
        #list {
          flex-direction: row;

          display: flex;
          width: 100%;

          > * {
            flex: 1;
            min-width: 0;
          }
        }
      }
    `,
  ];

  render() {
    if (
      !this.group ||
      !this.theme ||
      !this.group.presentation ||
      typeof this.group.presentation === "string"
    ) {
      return nothing;
    }

    const particleGroup = this.group;
    const theme = this.theme;

    return html`<section id="list" class=${classMap(theme.groups.list)}>
      ${particleGroup.group.size === 0
        ? html`<div>No items</div>`
        : repeat(particleGroup.group, ([id, particle]) => {
            const presentation =
              particle.presentation !== undefined &&
              particle.presentation !== null &&
              typeof particle.presentation !== "string"
                ? particle.presentation
                : {
                    behaviors: [],
                    orientation: "vertical",
                    segments: [],
                    type: "card",
                  };

            switch (presentation.type) {
              case "card": {
                return html`<particle-ui-card
                  class=${classMap(theme.groups.card)}
                  data-id=${id}
                  .segments=${presentation.segments}
                  .orientation=${presentation.orientation}
                >
                  ${repeat(presentation.segments, (segment, idx) => {
                    let classes = {};
                    if (segment.orientation === "vertical") {
                      if (segment.type === "media") {
                        classes = merge(
                          theme.groups.segmentVertical,
                          theme.modifiers.media
                        );
                      } else {
                        classes = {
                          ...theme.groups.segmentVerticalPadded,
                        };
                      }
                    } else {
                      if (segment.type === "media") {
                        classes = merge(
                          theme.groups.segmentHorizontal,
                          theme.modifiers.media
                        );
                      } else {
                        classes = {
                          ...theme.groups.segmentHorizontalPadded,
                        };
                      }
                    }

                    const values: Record<FieldName, ParticleData> = {};
                    for (const fieldName of Object.keys(segment.fields)) {
                      const key = fieldName as FieldName;
                      let value: string | null = null;
                      if (isGroupParticle(particle)) {
                        const groupParticle = particle.group.get(key);
                        if (groupParticle) {
                          value = extractValue(groupParticle);
                        }
                      } else {
                        value = extractValue(particle);
                      }

                      if (value === null) {
                        continue;
                      }

                      values[key] = value;
                    }

                    return html`<particle-ui-segment
                      class=${classMap(
                        merge(classes, {
                          "layout-al-fs": true,
                        })
                      )}
                      style=${styleMap({
                        "--weight": segment.weight,
                      })}
                      slot=${`slot-${idx}`}
                      .containerOrientation=${presentation.orientation}
                      .theme=${theme}
                      .fields=${segment.fields}
                      .values=${values}
                    ></particle-ui-segment>`;
                  })}
                </particle-ui-card>`;
              }

              case "list": {
                if (!isGroupParticle(particle)) {
                  return html`Unable to render list`;
                }

                let orientation = "vertical";
                if (
                  particle.presentation &&
                  typeof particle.presentation !== "string"
                ) {
                  orientation = particle.presentation.orientation;
                }

                return html` <particle-ui-list
                  class=${classMap(theme.groups.list)}
                  .group=${particle}
                  .orientation=${orientation}
                ></particle-ui-list>`;
              }
            }

            return html`Unexpected input information`;
          })}
    </section>`;
  }
}
