/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { Task, TaskStatus } from "@lit/task";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  environmentContext,
  type Environment,
} from "../../contexts/environment.js";
import { InputEnterEvent } from "../../events/events.js";
import {
  fetchAvailableConnections,
  type Connection,
} from "./connection-server.js";
import "./connection-signin.js";
import { tokenVendorContext } from "../../contexts/token-vendor.js";
import {
  type ExpiredTokenResult,
  TokenVendor,
} from "@breadboard-ai/connection-client";

/**
 * Input element for handling secrets provided by OAuth connections.
 */
@customElement("bb-connection-input")
export class ConnectionInput extends LitElement {
  @property()
  accessor connectionId: string | undefined = undefined;

  @consume({ context: environmentContext })
  accessor environment!: Environment;

  @consume({ context: tokenVendorContext })
  accessor tokenVendor!: TokenVendor;

  #availableConnections = fetchAvailableConnections(
    this,
    () => this.environment,
    // Don't autorun because we only need to do this fetch if we need to sign in
    // from scratch.
    false
  );

  #refreshTask = new Task(this, {
    autoRun: false,
    task: async (
      // TOOD(aomarks) The way we receive parameters here is a bit odd. It would
      // be cool if I could have some parameters defined in `args`, and others
      // passed to `run`, but right now Task only allows one or the other.
      [expired]: [ExpiredTokenResult],
      { signal }
    ) => {
      if (!expired) {
        throw new Error("Uninitialized");
      }
      const refreshed = await expired.refresh({ signal });
      this.#broadcastSecret(
        refreshed.grant.access_token,
        refreshed.grant.client_id
      );
    },
  });

  static styles = css`
    :host {
      display: block;
    }

    .signed-in,
    p {
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      color: var(--bb-neutral-600);
      margin: 0;
    }
  `;

  render() {
    if (!this.tokenVendor || !this.connectionId) {
      return nothing;
    }
    const grant = this.tokenVendor.getToken(this.connectionId);
    if (grant.state === "signedout") {
      return this.#renderSigninButton();
    } else if (grant.state === "expired") {
      return this.#refreshAndRenderStatus(grant);
    }
    this.#broadcastSecret(
      grant.grant.access_token,
      grant.grant.client_id,
      grant.grant.expires_in
    );
    return html`<div class="signed-in">Signed in</div>`;
  }

  #renderSigninButton() {
    if (!this.connectionId) {
      return "";
    }

    if (this.#availableConnections.status === TaskStatus.INITIAL) {
      this.#availableConnections.run();
    }

    return this.#availableConnections.render({
      pending: () => html`<p>Loading connections ...</p>`,
      error: (e) => html`<p>Error loading connections: ${e}</p>`,
      complete: (connections: Connection[]) => {
        const connection = connections.find(
          (connection) => connection.id === this.connectionId
        );
        if (!connection) {
          return html`<p>
            Could not find a connection for ${this.connectionId}
          </p>`;
        }
        return html`<bb-connection-signin
          .connection=${connection}
          @bbtokengranted=${({
            token,
            expiresIn,
          }: HTMLElementEventMap["bbtokengranted"]) => {
            this.#broadcastSecret(token, connection.clientId, expiresIn);
          }}
        ></bb-connection-signin>`;
      },
    });
  }

  #refreshAndRenderStatus(grant: ExpiredTokenResult) {
    if (this.#refreshTask.status === TaskStatus.INITIAL) {
      this.#refreshTask.run([grant]);
    }
    return this.#refreshTask.render({
      pending: () => html`<p>Refreshing token ...</p>`,
      error: (e) => html`<p>Error refreshing token: ${e}</p>`,
      complete: () => html`<p>Token refreshed</p>`,
    });
  }

  #broadcastSecret(secret: string, clientId: string, expiresIn?: number) {
    this.dispatchEvent(
      new InputEnterEvent(
        this.id,
        { clientId, secret, expiresIn },
        // Disable allowSavingIfSecret so that it does not get saved to the
        // regular secrets section, because we're managing this secret in a
        // special way using the connections system.
        false
      )
    );
  }
}
