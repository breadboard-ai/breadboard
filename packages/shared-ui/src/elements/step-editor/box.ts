/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, CSSResultGroup } from "lit";
import { customElement } from "lit/decorators.js";
import { Entity } from "./entity";
import { map } from "lit/directives/map.js";

@customElement("bb-box")
export class Box extends Entity {
  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      pointer-events: none;
      width: 0;
      height: 0;
    }

    :host([hidden]) {
      display: none;
    }

    #bounds {
      display: none;
    }

    :host([showbounds]) #bounds {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      outline: 2px solid red;
      pointer-events: none;

      & label {
        position: absolute;
        top: 2px;
        left: 2px;
        font-size: 11px;
        white-space: nowrap;
        color: red;
      }
    }

    #container {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      transform-origin: 0 0;
    }
  ` as CSSResultGroup;

  protected renderSelf() {
    return this.renderBounds();
  }

  render() {
    return [
      this.renderSelf(),
      html`${map(this.entities.values(), (entity) => {
        entity.showBounds = this.showBounds;
        return html`${entity}`;
      })}`,
    ];
  }
}
