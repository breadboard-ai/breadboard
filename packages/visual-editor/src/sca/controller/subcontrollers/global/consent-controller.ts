/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConsentAction,
  ConsentRequest,
  ConsentUIType,
} from "@breadboard-ai/types";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import { PendingConsent } from "../../../types.js";

export interface ConsentRecord {
  graphUrl: string;
  type: ConsentRequest["type"];
  scope: string;
  allow: boolean;
}

export type ConsentKey = `${string}|${string}|${string}`;

export function stringifyScope(scope: ConsentRequest["scope"]): string {
  if (typeof scope === "string") {
    return scope;
  }
  // Sort keys for consistent stringification.
  return JSON.stringify(scope, Object.keys(scope).sort());
}

export function createConsentKey(request: ConsentRequest): ConsentKey {
  return `${request.graphUrl}|${stringifyScope(request.scope)}|${request.type}`;
}

export class ConsentController extends RootController {
  @field({ persist: "idb", deep: true })
  private accessor _consents = new Map<ConsentKey, ConsentRecord>();

  @field({ deep: true })
  private accessor _pendingConsents = new Map<
    PendingConsent,
    (value: ConsentAction) => void
  >();

  get consents(): ReadonlyMap<ConsentKey, ConsentRecord> {
    return this._consents;
  }

  get pendingInApp(): ReadonlyArray<PendingConsent> {
    return this.#pending(ConsentUIType.IN_APP);
  }

  get pendingModal(): ReadonlyArray<PendingConsent> {
    return this.#pending(ConsentUIType.MODAL);
  }

  #pending(type?: ConsentUIType) {
    return [...this._pendingConsents.keys()].filter(
      (consent) => consent.askUsingUiType === type
    );
  }

  updatePendingRequest(pendingConsent: PendingConsent, allow: ConsentAction) {
    if (!this._pendingConsents.has(pendingConsent)) return;

    const resolver = this._pendingConsents.get(pendingConsent);
    this._pendingConsents.delete(pendingConsent);

    if (!resolver) return;
    resolver.call(null, allow);
  }

  #awaitPending(pendingConsent: PendingConsent): Promise<ConsentAction> {
    return new Promise<ConsentAction>((resolve) => {
      this._pendingConsents.set(pendingConsent, resolve);
    });
  }

  #setConsent(request: ConsentRequest, allow: boolean) {
    const consentKey = createConsentKey(request);
    this._consents.set(consentKey, {
      graphUrl: request.graphUrl,
      scope: stringifyScope(request.scope),
      type: request.type,
      allow,
    });
  }

  async queryConsent(
    request: ConsentRequest,
    askUsingUiType: ConsentUIType
  ): Promise<boolean | undefined> {
    const consentKey = createConsentKey(request);
    const record = this._consents.get(consentKey);

    let allow = record?.allow;
    if (!record || !record.allow) {
      if (allow === undefined && askUsingUiType) {
        const action = await this.#awaitPending({ request, askUsingUiType });

        switch (action) {
          case ConsentAction.ALLOW:
            allow = true;
            break;

          case ConsentAction.DENY:
            allow = false;
            break;

          case ConsentAction.ALWAYS_ALLOW:
            allow = true;
            this.#setConsent(request, true);
            break;

          case ConsentAction.ALWAYS_DENY:
            allow = false;
            this.#setConsent(request, false);
            break;
        }
      }
    }

    return Boolean(allow);
  }

  async clearAllConsents(): Promise<void> {
    this._consents.clear();
  }
}
