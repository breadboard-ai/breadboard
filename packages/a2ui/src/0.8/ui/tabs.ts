/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, PropertyValues, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { repeat } from "lit/directives/repeat.js";
import { StringValue } from "../types/primitives";
import { A2UIModelProcessor } from "../data/model-processor";
import { classMap } from "lit/directives/class-map.js";
import { v0_8 } from "../..";
import * as Styles from "./styles";

@customElement("a2ui-tabs")
export class Tabs extends Root {
  @property()
  accessor titles: StringValue[] | null = null;

  @property()
  accessor selected = 0;

  static styles = [
    Styles.all,
    css`
      :host {
        display: block;
        flex: var(--weight);
      }
    `,
  ];

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("selected")) {
      for (const child of this.children) {
        child.removeAttribute("slot");
      }
      const selectedChild = this.children[this.selected];
      if (!selectedChild) {
        return;
      }

      selectedChild.slot = "current";
    }
  }

  #renderTabs() {
    if (!this.titles) {
      return nothing;
    }

    console.log(this.theme.components.Tabs);

    return html`<div
      id="buttons"
      class=${classMap(this.theme.components.Tabs.element)}
    >
      ${repeat(this.titles, (title, idx) => {
        let titleString = "";
        if ("literalString" in title && title.literalString) {
          titleString = title.literalString;
        } else if ("literal" in title && title.literal !== undefined) {
          titleString = title.literal;
        } else if (title && "path" in title && title.path) {
          if (!this.processor || !this.component) {
            return html`(no model)`;
          }

          const textValue = this.processor.getData(
            this.component,
            title.path,
            this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
          );

          if (typeof textValue !== "string") {
            return html`(invalid)`;
          }

          titleString = textValue;
        }

        let classes;
        if (this.selected === idx) {
          classes = v0_8.UI.Utils.merge(
            this.theme.components.Tabs.controls.all,
            this.theme.components.Tabs.controls.selected
          );
        } else {
          classes = { ...this.theme.components.Tabs.controls.all };
        }

        console.log(66666, classes);

        return html`<button
          ?disabled=${this.selected === idx}
          class=${classMap(classes)}
          @click=${() => {
            this.selected = idx;
          }}
        >
          ${titleString}
        </button>`;
      })}
    </div>`;
  }

  #renderSlot() {
    return html`<slot name="current"></slot>`;
  }

  render() {
    return html`<section
      class=${classMap(this.theme.components.Tabs.container)}
    >
      ${[this.#renderTabs(), this.#renderSlot()]}
    </section>`;
  }
}
