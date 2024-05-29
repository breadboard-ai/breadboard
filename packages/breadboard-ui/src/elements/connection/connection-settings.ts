/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  environmentContext,
  type Environment,
} from "../../contexts/environment.js";
import type {
  CustomSettingsElement,
  SETTINGS_TYPE,
  Settings,
} from "../../types/types.js";
import {
  fetchAvailableConnections as fetchAvailableConnectionsTask,
  type Connection,
} from "./connection-server.js";

/**
 * Custom settings panel for signing in and out of connections to third party
 * apps/services.
 */
@customElement("bb-connection-settings")
export class ConnectionSettings
  extends LitElement
  implements CustomSettingsElement
{
  @property({ attribute: false })
  settingsType: SETTINGS_TYPE | undefined;

  @property({ attribute: false })
  settingsItems: Settings[SETTINGS_TYPE]["items"] | undefined;

  @consume({ context: environmentContext })
  environment?: Environment;

  /**
   * The available connections vary across deployment environments, so we fetch
   * them from the Breadboard Connection Server dynamically.
   */
  #availableConnections = fetchAvailableConnectionsTask(
    this,
    () => this.environment
  );

  render() {
    const connectionServerUrl = this.environment?.connectionServerUrl;
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
              // TODO(aomarks) Render a sign in/out widget.
              html`<li>${connection.id}</li>`
          )}
        </ul>`;
      },
    });
  }
}
