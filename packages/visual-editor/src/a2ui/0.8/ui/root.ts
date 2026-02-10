/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import {
  css,
  html,
  LitElement,
  nothing,
  PropertyValues,
  render,
  TemplateResult,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { reactive } from "../../../sca/reactive.js";
import { A2UIModelProcessor } from "../data/model-processor.js";
import { StringValue } from "../types/primitives.js";
import { AnyComponentNode, CustomNode, SurfaceID } from "../types/types.js";
import { Theme } from "../types/types.js";
import { themeContext } from "./context/theme.js";

type NodeOfType<T extends AnyComponentNode["type"]> = Extract<
  AnyComponentNode,
  { type: T }
>;

/**
 * Base class for all A2UI components.
 *
 * Root extends `SignalWatcher(LitElement)` and provides the core rendering
 * mechanism for the A2UI component tree. All components inherit from Root,
 * gaining a uniform set of properties (surfaceId, processor, childComponents,
 * etc.) and the **light DOM rendering** behavior.
 *
 * **Light DOM rendering**: When `childComponents` is set, Root creates a
 * reactive effect that renders child elements into the component's own light
 * DOM (not shadow DOM). Those children are then projected into the shadow
 * DOM via `<slot>`. This design enables direct DOM interrogability — any
 * parent can walk `this.children` to inspect its descendants without
 * traversing shadow roots.
 *
 * @see {@link ../../../a2ui/A2UI.md} for full architectural documentation.
 */
@customElement("a2ui-root")
export class Root extends SignalWatcher(LitElement) {
  @property()
  accessor surfaceId: SurfaceID | null = null;

  @property()
  accessor component: AnyComponentNode | null = null;

  @consume({ context: themeContext })
  accessor theme!: Theme;

  @property({ attribute: false })
  accessor childComponents: AnyComponentNode[] | null = null;

  @property({ attribute: false })
  accessor processor: A2UIModelProcessor | null = null;

  @property()
  accessor dataContextPath: string = "";

  /**
   * Whether to allow rendering custom element types (non-built-in component
   * types). When true, unknown types in the component tree fall through to the
   * `default:` case in `renderComponentTree`, which uses `customElements.get()`
   * to instantiate them.
   */
  @property()
  accessor enableCustomElements = false;

  /**
   * Whether this component represents media content (image, video, audio).
   * Custom elements override this to `true` to participate in parent-level
   * media detection (e.g. Button's `detectMedia()`).
   */
  @property({ attribute: false })
  accessor isMedia = false;

  @property()
  set weight(weight: string | number) {
    this.#weight = weight;
    this.style.setProperty("--weight", `${weight}`);
  }

  get weight() {
    return this.#weight;
  }

  #weight: string | number = 1;

  static styles = [
    css`
      :host {
        display: flex;
        gap: 8px;
      }
    `,
  ];

  /**
   * Holds the cleanup function for our effect.
   * We need this to stop the effect when the component is disconnected.
   */
  #lightDomEffectDisposer: null | (() => void) = null;

  /**
   * Sets up a reactive effect that renders child components into the light DOM.
   *
   * When `childComponents` changes, the previous effect is disposed and a new
   * one is created. The `reactive()` wrapper (from the SCA infrastructure)
   * creates a signal effect — any `SignalMap`, `SignalArray`, etc. read during
   * `renderComponentTree` automatically subscribes this effect to updates.
   *
   * The result is imperatively rendered into `this` (the element itself), not
   * the shadow root. Children appear in the light DOM and are projected into
   * the shadow DOM's `<slot>`.
   */
  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("childComponents")) {
      if (this.#lightDomEffectDisposer) {
        this.#lightDomEffectDisposer();
      }

      this.#lightDomEffectDisposer = reactive(() => {
        const allChildren = this.childComponents ?? null;
        const lightDomTemplate = this.renderComponentTree(allChildren);
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
   * Maps `AnyComponentNode` types to their corresponding Lit templates.
   *
   * This is the single point where the component type → HTML element mapping
   * lives. Built-in types dispatch to declarative Lit templates; unknown types
   * (when `enableCustomElements` is true) fall through to imperative
   * instantiation via `customElements.get()`.
   */
  private renderComponentTree(
    components: AnyComponentNode[] | AnyComponentNode | null
  ): TemplateResult | typeof nothing {
    if (!components) {
      return nothing;
    }

    if (!Array.isArray(components) && components) {
      components = [components];
    }

    return html` ${map(components, (component) => {
      switch (component.type) {
        case "List": {
          const node = component as NodeOfType<"List">;
          const childComponents = node.properties.children;
          return html`<a2ui-list
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .direction=${node.properties.direction ?? "vertical"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .childComponents=${childComponents}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-list>`;
        }

        case "Card": {
          const node = component as NodeOfType<"Card">;
          let childComponents: AnyComponentNode[] | null =
            node.properties.children;
          if (!childComponents && node.properties.child) {
            childComponents = [node.properties.child];
          }

          return html`<a2ui-card
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .childComponents=${childComponents}
            .dataContextPath=${node.dataContextPath ?? ""}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-card>`;
        }

        case "Column": {
          const node = component as NodeOfType<"Column">;
          return html`<a2ui-column
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .childComponents=${node.properties.children ?? null}
            .dataContextPath=${node.dataContextPath ?? ""}
            .alignment=${node.properties.alignment ?? "stretch"}
            .distribution=${node.properties.distribution ?? "start"}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-column>`;
        }

        case "Row": {
          const node = component as NodeOfType<"Row">;
          return html`<a2ui-row
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .childComponents=${node.properties.children ?? null}
            .dataContextPath=${node.dataContextPath ?? ""}
            .alignment=${node.properties.alignment ?? "stretch"}
            .distribution=${node.properties.distribution ?? "start"}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-row>`;
        }

        case "Image": {
          const node = component as NodeOfType<"Image">;
          return html`<a2ui-image
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .url=${node.properties.url ?? null}
            .dataContextPath=${node.dataContextPath ?? ""}
            .usageHint=${node.properties.usageHint}
            .enableCustomElements=${this.enableCustomElements}
            .isMedia=${true}
          ></a2ui-image>`;
        }

        case "Icon": {
          const node = component as NodeOfType<"Icon">;
          return html`<a2ui-icon
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .name=${node.properties.name ?? null}
            .dataContextPath=${node.dataContextPath ?? ""}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-icon>`;
        }

        case "AudioPlayer": {
          const node = component as NodeOfType<"AudioPlayer">;
          return html`<a2ui-audioplayer
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .url=${node.properties.url ?? null}
            .dataContextPath=${node.dataContextPath ?? ""}
            .enableCustomElements=${this.enableCustomElements}
            .isMedia=${true}
          ></a2ui-audioplayer>`;
        }

        case "Button": {
          const node = component as NodeOfType<"Button">;
          return html`<a2ui-button
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .action=${node.properties.action}
            .primary=${node.properties.primary ?? false}
            .childComponents=${[node.properties.child]}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-button>`;
        }

        case "Text": {
          const node = component as NodeOfType<"Text">;
          return html`<a2ui-text
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .surfaceId=${this.surfaceId}
            .processor=${this.processor}
            .dataContextPath=${node.dataContextPath ?? ""}
            .text=${node.properties.text}
            .usageHint=${node.properties.usageHint}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-text>`;
        }

        case "CheckBox": {
          const node = component as NodeOfType<"CheckBox">;
          return html`<a2ui-checkbox
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .label=${node.properties.label}
            .value=${node.properties.value}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-checkbox>`;
        }

        case "DateTimeInput": {
          const node = component as NodeOfType<"DateTimeInput">;
          return html`<a2ui-datetimeinput
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .enableDate=${node.properties.enableDate ?? true}
            .enableTime=${node.properties.enableTime ?? true}
            .outputFormat=${node.properties.outputFormat}
            .value=${node.properties.value}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-datetimeinput>`;
        }

        case "Divider": {
          // TODO: thickness, axis and color.
          const node = component as NodeOfType<"Divider">;
          return html`<a2ui-divider
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .thickness=${node.properties.thickness}
            .axis=${node.properties.axis}
            .color=${node.properties.color}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-divider>`;
        }

        case "MultipleChoice": {
          // TODO: maxAllowedSelections and selections.
          const node = component as NodeOfType<"MultipleChoice">;
          return html`<a2ui-multiplechoice
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .options=${node.properties.options}
            .maxAllowedSelections=${node.properties.maxAllowedSelections}
            .selections=${node.properties.selections}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-multiplechoice>`;
        }

        case "Slider": {
          const node = component as NodeOfType<"Slider">;
          return html`<a2ui-slider
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .value=${node.properties.value}
            .minValue=${node.properties.minValue}
            .maxValue=${node.properties.maxValue}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-slider>`;
        }

        case "TextField": {
          // TODO: type and validationRegexp.
          const node = component as NodeOfType<"TextField">;
          return html`<a2ui-textfield
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .label=${node.properties.label}
            .text=${node.properties.text}
            .type=${node.properties.type}
            .validationRegexp=${node.properties.validationRegexp}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-textfield>`;
        }

        case "Video": {
          const node = component as NodeOfType<"Video">;
          return html`<a2ui-video
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .url=${node.properties.url}
            .enableCustomElements=${this.enableCustomElements}
            .isMedia=${true}
          ></a2ui-video>`;
        }

        case "Tabs": {
          const node = component as NodeOfType<"Tabs">;
          const titles: StringValue[] = [];
          const childComponents: AnyComponentNode[] = [];
          if (node.properties.tabItems) {
            for (const item of node.properties.tabItems) {
              titles.push(item.title);
              childComponents.push(item.child);
            }
          }

          return html`<a2ui-tabs
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .titles=${titles}
            .childComponents=${childComponents}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-tabs>`;
        }

        case "Modal": {
          const node = component as NodeOfType<"Modal">;
          const childComponents: AnyComponentNode[] = [
            node.properties.entryPointChild,
            node.properties.contentChild,
          ];

          node.properties.entryPointChild.slotName = "entry";

          return html`<a2ui-modal
            id=${node.id}
            slot=${node.slotName ? node.slotName : nothing}
            .component=${node}
            .weight=${node.weight ?? "initial"}
            .processor=${this.processor}
            .surfaceId=${this.surfaceId}
            .dataContextPath=${node.dataContextPath ?? ""}
            .childComponents=${childComponents}
            .enableCustomElements=${this.enableCustomElements}
          ></a2ui-modal>`;
        }

        default: {
          if (!this.enableCustomElements) {
            return;
          }

          const node = component as CustomNode;
          const elCtor = customElements.get(component.type);
          if (!elCtor) {
            return html`Unknown element ${component.type}`;
          }

          const el = new elCtor() as Root;
          el.id = node.id;
          if (node.slotName) {
            el.slot = node.slotName;
          }
          let childComponents: AnyComponentNode[] | null = node.properties
            .children as AnyComponentNode[] | null;
          if (!childComponents && node.properties.child) {
            childComponents = [node.properties.child as AnyComponentNode];
          }

          el.component = node;
          el.weight = node.weight ?? "initial";
          el.processor = this.processor;
          el.surfaceId = this.surfaceId;
          el.dataContextPath = node.dataContextPath ?? "/";
          el.childComponents = childComponents;
          el.enableCustomElements = this.enableCustomElements;

          for (const [prop, val] of Object.entries(component.properties)) {
            // @ts-expect-error We're off the books.
            el[prop] = val;
          }
          return html`${el}`;
        }
      }
    })}`;
  }

  render(): TemplateResult | typeof nothing {
    return html`<slot></slot>`;
  }
}
