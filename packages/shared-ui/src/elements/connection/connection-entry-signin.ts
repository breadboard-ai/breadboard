/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Environment, environmentContext } from "../../contexts/environment";
import { settingsHelperContext } from "../../contexts/settings-helper";
import { SettingsHelper } from "../../types/types";
import { tokenVendorContext } from "../../contexts/token-vendor";
import { TokenVendor } from "@breadboard-ai/connection-client";
import { SigninAdapter } from "../../utils/signin-adapter";
import { until } from "lit/directives/until.js";

@customElement("bb-connection-entry-signin")
export class ConnectionEntrySignin extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      width: 300px;
      height: 50px;
      z-index: 100;
    }
  `;

  @consume({ context: environmentContext })
  accessor environment!: Environment;

  @consume({ context: settingsHelperContext })
  accessor settingsHelper!: SettingsHelper;

  @consume({ context: tokenVendorContext })
  accessor tokenVendor!: TokenVendor;

  @state()
  accessor signedin = false;

  render() {
    const adapter = new SigninAdapter(
      this.tokenVendor,
      this.environment,
      this.settingsHelper
    );
    if (adapter.state !== "signedout") return nothing;
    return html`<a
      .href=${until(adapter.getSigninUrl())}
      @click=${adapter.whenSignedIn(async (adapter) => {
        // The adapter is immutable, this
        // callback will always return a
        // new copy with a new state,
        // including picture and name.
        console.log("SIGNED IN", adapter);
        if (adapter.state === "valid") {
          this.signedin = true;
        }
      })}
      target="_blank"
      title="Sign into Google"
      >Sign into Google</a
    >`;
  }
}
