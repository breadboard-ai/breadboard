/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";

@customElement("bb-capabilities-selector")
export class CapabilitiesSelector extends LitElement {
  @property()
  capabiliies = new Map([
    [
      "Describe",
      {
        icon: "eye",
        code: `import describeGraph from "@describe";`,
        description: "Allows asking a graph to describe itself.",
      },
    ],
    [
      "Fetch",
      {
        icon: "fetch",
        code: `import fetch from "@fetch";`,
        description: "Obtains data from a remote source like a website or API.",
      },
    ],
    [
      "Secrets",
      {
        icon: "secrets",
        code: `import secrets from "@secrets";`,
        description:
          "Retrieves user-provided data such as API keys and passwords.",
      },
    ],
    [
      "Invoke",
      {
        icon: "invoke",
        code: `import describeGraph from "@invoke";`,
        description: "Runs another board and returns its output values.",
      },
    ],
    [
      "Output",
      {
        icon: "output",
        code: `import output from "@output";`,
        description: "Provides updates to the user.",
      },
    ],
  ]);

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    ul {
      margin: 0;
      padding: 0 0 var(--bb-grid-size-3) 0;
      display: block;
      list-style: none;
    }

    ul li.capability-item .capability-id {
      position: relative;
      white-space: nowrap;
      margin: var(--bb-grid-size) 0;
      font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    ul li.capability-item .capability-description {
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      white-space: normal;
      position: relative;
      overflow: hidden;
    }

    ul li.capability-item {
      margin: var(--bb-grid-size) 0;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      width: 100%;
      border-radius: 12px;
      position: relative;
      background: #fff;
      cursor: grab;
      display: grid;
      grid-template-columns: 28px minmax(0, auto);
      column-gap: var(--bb-grid-size-2);
    }

    ul li.capability-item:hover::before {
      content: "";
      background: var(--bb-ui-50);
      position: absolute;
      left: var(--bb-grid-size-2);
      top: 1px;
      bottom: 1px;
      right: var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size);
      z-index: 0;
      opacity: 1;
    }

    ul li.capability-item:active {
      cursor: grabbing;
    }

    ul li.capability-item span {
      position: relative;
      z-index: 1;
    }

    ul li.capability-item .capability-icon {
      position: relative;
    }

    ul li.capability-item .capability-icon::before {
      content: "";
      position: absolute;
      width: 28px;
      height: 28px;
      background: none top left / 28px 28px no-repeat;
      top: 0;
      left: 0;
    }

    ul li.capability-item .capability-icon.fetch::before {
      background-image: var(--bb-icon-fetch);
    }

    ul li.capability-item .capability-icon.secrets::before {
      background-image: var(--bb-icon-secrets);
    }

    ul li.capability-item .capability-icon.invoke::before {
      background-image: var(--bb-icon-invoke);
    }

    ul li.capability-item .capability-icon.output::before {
      background-image: var(--bb-icon-output);
    }

    ul li.capability-item .capability-icon.eye::before {
      background-image: var(--bb-icon-eye);
    }
  `;

  render() {
    return html`<ul>
      ${map(this.capabiliies, ([title, details]) => {
        return html`<li
          draggable="true"
          class="capability-item"
          @dragstart=${(evt: DragEvent) => {
            evt.dataTransfer?.setData("text/plain", `${details.code}\n`);
          }}
        >
          <div
            class=${classMap({
              "capability-icon": true,
              [details.icon]: true,
            })}
          ></div>
          <div>
            <div class="capability-id">${title}</div>
            ${details.description
              ? html`<div class="capability-description">
                  ${details.description}
                </div>`
              : nothing}
          </div>
        </li>`;
      })}
    </ul>`;
  }
}
