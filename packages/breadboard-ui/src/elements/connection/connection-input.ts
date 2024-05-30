/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  environmentContext,
  type Environment,
} from "../../contexts/environment.js";
import { settingsHelperContext } from "../../contexts/settings-helper.js";
import { SETTINGS_TYPE, type SettingsHelper } from "../../types/types.js";
import type { GrantSettingsValue } from "./connection-common.js";
import "./connection-signin.js";
import {
  type Connection,
  fetchAvailableConnections,
} from "./connection-server.js";
import { Task, TaskStatus } from "@lit/task";
import { InputEnterEvent } from "../../events/events.js";

/**
 * If a token is going to expire in less than this many milliseconds, we treat
 * it as though it is already expired, since there might be a delay between
 * returning it from here and it actually getting used.
 */
const EXPIRY_THRESHOLD_MS = /* 1 minute */ 60_000;

/**
 * Input element for handling secrets provided by OAuth connections.
 */
@customElement("bb-connection-input")
export class ConnectionInput extends LitElement {
  @property()
  connectionId?: string;

  @consume({ context: environmentContext })
  environment?: Environment;

  @consume({ context: settingsHelperContext })
  settingsHelper?: SettingsHelper;

  #availableConnections = fetchAvailableConnections(
    this,
    () => this.environment,
    // Don't autorun because we only need to do this fetch if we need to sign in
    // from scratch.
    false
  );

  #refreshTask = new Task(this, {
    autoRun: false,
    task: (
      // TOOD(aomarks) The way we receive parameters here is a bit odd. It would
      // be cool if I could have some parameters defined in `args`, and others
      // passed to `run`, but right now Task only allows one or the other.
      [grant, connectionId, environment, settingsHelper]: [
        GrantSettingsValue,
        typeof this.connectionId,
        typeof this.environment,
        typeof this.settingsHelper,
      ],
      { signal }
    ) => {
      if (!grant || !connectionId || !environment || !settingsHelper) {
        throw new Error("Uninitialized");
      }
      this.#refresh(grant, connectionId, environment, settingsHelper, signal);
    },
  });

  static styles = css`
    bb-connection-signin {
      margin-top: 14px;
    }
  `;

  render() {
    const grant = this.#getGrantFromSettings();
    if (grant === undefined) {
      return this.#renderSigninButton();
    }
    const expired = this.#accessTokenIsExpired(grant);
    if (expired) {
      return this.#refreshAndRenderStatus(grant);
    }
    this.#broadcastSecret(grant.access_token);
    return html`Token was fresh`;
  }

  #getGrantFromSettings(): GrantSettingsValue | undefined {
    if (!this.connectionId || !this.settingsHelper) {
      return undefined;
    }
    const setting = this.settingsHelper.get(
      SETTINGS_TYPE.CONNECTIONS,
      this.connectionId
    );
    if (setting === undefined) {
      return undefined;
    }
    return JSON.parse(String(setting.value)) as GrantSettingsValue;
  }

  #accessTokenIsExpired(grant: GrantSettingsValue): boolean {
    const expiresAt =
      /* absolute milliseconds */ grant.issue_time +
      /* relative seconds */ grant.expires_in * 1000;
    const expiresIn = expiresAt - /* unix milliseconds */ Date.now();
    return expiresIn <= EXPIRY_THRESHOLD_MS;
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
          }: HTMLElementEventMap["bbtokengranted"]) => {
            this.#broadcastSecret(token);
          }}
        ></bb-connection-signin>`;
      },
    });
  }

  #refreshAndRenderStatus(grant: GrantSettingsValue) {
    if (this.#refreshTask.status === TaskStatus.INITIAL) {
      this.#refreshTask.run([
        grant,
        this.connectionId,
        this.environment,
        this.settingsHelper,
      ]);
    }
    return this.#refreshTask.render({
      pending: () => html`<p>Refreshing token ...</p>`,
      error: (e) => html`<p>Error refreshing token: ${e}</p>`,
      complete: () => html`<p>Token refreshed!</p>`,
    });
  }

  async #refresh(
    grant: GrantSettingsValue,
    connectionId: string,
    environment: Environment,
    settingsHelper: SettingsHelper,
    signal: AbortSignal
  ) {
    const refreshUrl = new URL("refresh", environment.connectionServerUrl);
    refreshUrl.search = new URLSearchParams({
      connection_id: connectionId,
      refresh_token: grant.refresh_token,
    } satisfies RefreshRequest).toString();

    const now = Date.now();
    const httpRes = await fetch(refreshUrl, { signal });
    if (!httpRes.ok) {
      throw new Error(String(httpRes.status));
    }
    const jsonRes = (await httpRes.json()) as RefreshResponse;
    if (jsonRes.error !== undefined) {
      throw new Error(jsonRes.error);
    }

    const updatedGrant: GrantSettingsValue = {
      access_token: jsonRes.access_token,
      expires_in: jsonRes.expires_in,
      issue_time: now,
      refresh_token: grant.refresh_token,
    };
    settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, connectionId, {
      name: connectionId,
      value: JSON.stringify(updatedGrant),
    });
    this.#broadcastSecret(grant.access_token);
  }

  #broadcastSecret(secret: string) {
    this.dispatchEvent(
      new InputEnterEvent(
        this.id,
        { secret },
        // Disable allowSavingIfSecret so that it does not get saved to the
        // regular secrets section, because we're managing this secret in a
        // special way using the connections system.
        false
      )
    );
  }
}

// IMPORTANT: Keep in sync with
// breadboard/packages/connection-server/src/api/refresh.ts
interface RefreshRequest {
  connection_id: string;
  refresh_token: string;
}

type RefreshResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
    };
