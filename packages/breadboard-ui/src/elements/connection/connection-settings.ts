/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type {
  CustomSettingsElement,
  SETTINGS_TYPE,
  Settings,
} from "../../types/types.js";

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

  render() {
    return html`<p>(Not yet implemented)</p>`;
  }
}
