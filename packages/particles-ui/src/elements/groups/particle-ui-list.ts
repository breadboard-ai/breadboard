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
  Orientation,
  ParticleData,
} from "@breadboard-ai/particles";
import { UITheme } from "../../types/types.js";
import { merge } from "../../utils/utils.js";

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
        display: block;
      }

      #items {
        overflow: auto;
        scrollbar-width: none;
      }

      :host([orientation="vertical"]) {
        #items {
          display: flex;
          flex-direction: column;
          align-items: start;
        }
      }

      :host([orientation="horizontal"]) {
        #items {
          display: flex;
          flex-direction: row;

          & > * {
            max-width: 100%;
            flex: 0 0 auto;
            margin-right: var(--g-5);

            &:last-of-type {
              margin-right: 0;
            }
          }

          &:has(> :nth-child(2)) {
            mask-image: linear-gradient(
              to right,
              rgba(255, 0, 255, 0) 0%,
              rgba(255, 0, 255, 0.9) 12px,
              rgba(255, 0, 255, 1) 16px,
              rgba(255, 0, 255, 1) calc(100% - 16px),
              rgba(255, 0, 255, 0) 100%
            );

            margin-left: -16px;
            margin-right: -16px;

            padding-left: 16px;
            padding-right: 16px;

            & > * {
              max-width: 80%;
            }
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
      ${this.group.presentation.behaviors.includes("editable")
        ? html`<div class=${classMap(theme.layouts.verticalPadded)}>
            <div class=${classMap(theme.layouts.horizontal)}>
              <ui-button
                class=${classMap(theme.elements.button)}
                data-behavior="add"
                .icon=${"add"}
              >
                Add
              </ui-button>
            </div>
          </div>`
        : nothing}
      <section id="items" class=${classMap(theme.groups.listItems)}>
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
                        const value = extractValue(particle);
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
                        slot=${`slot-${idx}`}
                        .containerOrientation=${presentation.orientation}
                        .theme=${theme}
                        .fields=${segment.fields}
                        .values=${values}
                      ></particle-ui-segment>`;
                    })}
                  </particle-ui-card>`;
                }
              }

              return html`Unexpected input information`;
            })}
      </section>
    </section>`;
  }
}
