/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ParticlesUI from "@breadboard-ai/particles-ui";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { theme as uiTheme } from "./theme/light.js";
import {
  GroupParticle,
  isGroupParticle,
  SerializedGroupParticle,
  toParticle,
} from "@breadboard-ai/particles";
import { provide } from "@lit/context";
import { resolve } from "./resolver";

import Data from "./data/data.json" assert { type: "json" };
import { twoColumnMediaLeft as template } from "./data/template";

function inflateParticles(data: SerializedGroupParticle): GroupParticle | null {
  const group = toParticle(data);
  if (!isGroupParticle(group)) {
    return null;
  }

  const root: GroupParticle = {
    group: new Map([["root", resolve(group, template)]]),
    presentation: {
      behaviors: [],
      orientation: "vertical",
      type: "list",
    },
  };

  return root;
}

@customElement("alternative-demo")
export class AlternativeDemo extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    particle-ui-list {
      max-width: 900px;
      width: 90%;
    }
  `;

  @provide({ context: ParticlesUI.Context.themeContext })
  accessor theme: ParticlesUI.Types.UITheme = uiTheme;

  @property()
  accessor root: GroupParticle | null = null;

  constructor() {
    super();

    this.root = inflateParticles(Data as unknown as SerializedGroupParticle);
  }

  render() {
    if (!this.root) {
      return nothing;
    }

    if (!this.root.presentation || typeof this.root.presentation === "string") {
      return html`Unpresentable group`;
    }

    return html` <particle-ui-list
      class=${classMap(this.theme.groups.list)}
      .group=${this.root}
      .orientation=${this.root.presentation.orientation}
    ></particle-ui-list>`;
  }
}

const demo = new AlternativeDemo();
document.body.appendChild(demo);
