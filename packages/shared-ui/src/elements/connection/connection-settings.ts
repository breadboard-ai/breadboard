/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";
import {
  globalConfigContext,
  type GlobalConfig,
} from "../../contexts/global-config.js";
import type { CustomSettingsElement } from "../../types/types.js";
import {
  fetchAvailableConnections,
  type Connection,
} from "./connection-server.js";
import "./connection-signin.js";

/**
 * Custom settings panel for signing in and out of connections to third party
 * apps/services.
 */
@customElement("bb-connection-settings")
export class ConnectionSettings
  extends LitElement
  implements CustomSettingsElement
{
  @consume({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig | undefined;

  /**
   * The available connections vary across deployment environments, so we fetch
   * them from the Breadboard Connection Server dynamically.
   */
  #availableConnections = fetchAvailableConnections(
    this,
    () => this.globalConfig,
    /* autorun */ true
  );

  static styles = css`
    ul {
      margin: 8px 0 0 0;
      padding: 0;
      width: 100%;
    }
    li {
      list-style-type: none;
      margin-bottom: 15px;
    }
  `;

  render() {
    const connectionServerUrl = this.globalConfig?.connectionServerUrl;
    if (!connectionServerUrl) {
      return html`No connection server URL configured.`;
    }
    return this.#availableConnections.render({
      pending: () => html`<p>Loading connections ...</p>`,
      error: (e) => html`<p>Error loading connections: ${e}</p>`,
      complete: (connections: Connection[]) => {
        if (connections.length === 0) {
          return html`<p>No connections available</p>`;
        }
        return html`<ul>
          ${connections.map(
            (connection) =>
              html`<li>
                <bb-connection-signin
                  .connection=${connection}
                ></bb-connection-signin>
              </li>`
          )}
        </ul>`;
      },
    });
  }
}
