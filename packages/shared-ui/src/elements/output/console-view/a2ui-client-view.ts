/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { v0_8 } from "@breadboard-ai/a2ui";
import * as A2UI from "@breadboard-ai/a2ui/ui";
import { theme as uiTheme } from "../../../a2ui-theme/a2ui-theme.js";

import { icons } from "../../../styles/icons.js";
import { sharedStyles } from "./shared-styles.js";
import { colorsLight } from "../../../styles/host/colors-light.js";
import { type } from "../../../styles/host/type.js";

import "@breadboard-ai/a2ui/ui";
import { provide } from "@lit/context";

@customElement("bb-a2ui-client-view")
export class A2UIClientView extends SignalWatcher(LitElement) {
  @provide({ context: A2UI.Context.themeContext })
  accessor theme: v0_8.Types.Theme = uiTheme;

  @property()
  accessor processor: v0_8.Types.ModelProcessor | null = null;

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
  render() {
    const surfaces = this.processor?.getSurfaces();
    if (!surfaces) return nothing;

    return html`<section id="surfaces">
      ${repeat(
        surfaces,
        ([surfaceId]) => surfaceId,
        ([surfaceId, surface]) => {
          return html`<a2ui-surface
            .surfaceId=${surfaceId}
            .surface=${surface}
            .processor=${this.processor}
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
                    const path = this.processor!.resolvePath(
                      item.value.path,
                      evt.detail.dataContextPath
                    );
                    const value = this.processor!.getData(
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
          ></a2ui-surface>`;
        }
      )}
    </section>`;
  }
}
