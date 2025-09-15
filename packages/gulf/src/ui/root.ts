/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import {
  html,
  LitElement,
  nothing,
  PropertyValues,
  render,
  TemplateResult,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { ComponentType, ExpandedGULFValue } from "../types/types";
import { TagName } from "./ui";
import { effect } from "signal-utils/subtle/microtask-effect";

const elementMap: Map<ComponentType, TagName> = new Map([
  // ["AudioPlayer", "gulf-audioplayer" ],
  ["Card", "gulf-card"],
  ["List", "gulf-list"],
  ["Button", "gulf-button"],
  ["Carousel", "gulf-carousel"],
  ["Divider", "gulf-divider"],
  ["Image", "gulf-image"],
  ["MultipleChoice", "gulf-multiplechoice"],
  // ["MutuallyExclusiveMultipleChoice", "gulf-radio"],
  // ["Slider", "gulf-range"],
  // ["Tabs", "gulf-tabs"],
  ["Text", "gulf-text"],
  ["TextField", "gulf-textfield"],
]);

// This is the new base class all your components will inherit
@customElement("gulf-root")
export class Root extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor gulfChildren: ExpandedGULFValue["children"] | null = null;

  @property({ attribute: false })
  accessor data: ExpandedGULFValue["data"] | null = null;

  @property({ attribute: false })
  accessor valueBinding: string | null = null;

  /**
   * Holds the cleanup function for our effect.
   * We need this to stop the effect when the component is disconnected.
   */
  #lightDomEffectDisposer: null | (() => void) = null;

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("gulfChildren") && this.gulfChildren) {
      if (this.#lightDomEffectDisposer) {
        this.#lightDomEffectDisposer();
      }

      // This effect watches the gulfChildren signal and updates the Light DOM.
      this.#lightDomEffectDisposer = effect(() => {
        // 1. Read the signal to create the subscription.
        const childrenMap = this.gulfChildren;

        // 2. Generate the template for the children.
        const lightDomTemplate = this.renderGulfChildren(childrenMap);

        // 3. Imperatively render that template into the component itself.
        render(lightDomTemplate, this, { host: this });
      });
    }
  }

  /**
   * Clean up the effect when the component is removed from the DOM.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this.#lightDomEffectDisposer) {
      this.#lightDomEffectDisposer();
    }
  }

  /**
   * Turns the SignalMap into a renderable TemplateResult for Lit.
   */
  private renderGulfChildren(
    map: ExpandedGULFValue["children"] | null
  ): TemplateResult | typeof nothing {
    if (!map) {
      return nothing;
    }

    // Subscribes to the Signals.
    const children = [...map.entries()];
    return html`
      ${children.map(([id, childData]) => {
        const elementName =
          elementMap.get(childData.component.type) ?? "gulf-unknown";

        switch (elementName) {
          case "gulf-list": {
            return html`<gulf-list
              id=${id}
              .data=${childData.data}
              .gulfChildren=${childData.children}
            ></gulf-list>`;
          }

          case "gulf-card": {
            return html`<gulf-card
              id=${id}
              .data=${childData.data}
              .gulfChildren=${childData.children}
            ></gulf-card>`;
          }

          case "gulf-carousel": {
            return html`<gulf-carousel
              id=${id}
              .data=${childData.data}
              .gulfChildren=${childData.children}
            ></gulf-carousel>`;
            break;
          }

          case "gulf-text": {
            return html`<gulf-text
              id=${id}
              .text=${childData.component.text}
              .data=${childData.data}
              .gulfChildren=${childData.children}
            ></gulf-text>`;
          }

          case "gulf-textfield": {
            return html`<gulf-textfield
              id=${id}
              .description=${childData.component.description}
              .inputType=${childData.component.inputType}
              .data=${childData.data}
              .gulfChildren=${childData.children}
              .valueBinding=${childData.component.valueBinding}
            ></gulf-textfield>`;
            break;
          }

          case "gulf-multiplechoice": {
            return html`<gulf-multiplechoice
              id=${id}
              .options=${childData.component.options}
              .data=${childData.data}
              .gulfChildren=${childData.children}
              .valueBinding=${childData.component.valueBinding}
            ></gulf-multiplechoice>`;
          }

          case "gulf-image": {
            return html`<gulf-image
              id=${id}
              .url=${childData.component.url}
              .data=${childData.data}
              .gulfChildren=${childData.children}
            ></gulf-image>`;
          }
          case "gulf-button": {
            return html`<gulf-button
              id=${id}
              .action=${childData.component.action}
              .label=${childData.component.label}
              .data=${childData.data}
              .gulfChildren=${childData.children}
            ></gulf-button>`;
          }

          case "gulf-divider": {
            return html`<gulf-divider
              id=${id}
              .data=${childData.data}
              .gulfChildren=${childData.children}
            ></gulf-divider>`;
          }
        }
      })}
    `;
  }

  render() {
    return html`<slot></slot>`;
  }
}
