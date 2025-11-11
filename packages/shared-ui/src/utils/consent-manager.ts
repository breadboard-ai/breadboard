/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  ConsentAction,
  ConsentRequest,
  ConsentManager as ConsentManagerInterface,
  ConsentType,
  ConsentUIType,
} from "@breadboard-ai/types";
import { HTMLTemplateResult, html } from "lit";

const Strings = BreadboardUI.Strings.forSection("Global");

// Helper type to extract the specific ConsentRequest subtype based on the ConsentType
type ConsentRequestOfType<T extends ConsentType> = Extract<ConsentRequest, { type: T }>;

// Interface for the render info for a single ConsentType
interface ConsentRenderInfo<T extends ConsentType> {
  name: string;
  description: (request: ConsentRequestOfType<T>) => HTMLTemplateResult;
}

// The type for the main CONSENT_RENDER_INFO object
type ConsentRenderInfoMap = {
  [K in ConsentType]: ConsentRenderInfo<K>;
};

export const CONSENT_RENDER_INFO: ConsentRenderInfoMap = {
  [ConsentType.GET_ANY_WEBPAGE]: {
    name: "Allow access to webpages?",
    description: () => html`
      <p>This Opal was created by another person and accesses external websites.</p>
      <p>Keep your personal info private by only sharing info with Opals you trust.</p>
    `
  },
  [ConsentType.OPEN_WEBPAGE]: {
    name: "Open webpage?",
    description: (request) => html`
      <p>This Opal would like to open a webpage on the following site:</p>
      <p class="center" style="word-break: break-all;">${request.scope}</p>
      <p>Only click allow if you recognize this site and trust the Opal.</p>
    `
  },
};

interface ConsentRecord {
  graphUrl: string;
  type: ConsentRequest['type'];
  scope: string;
  allow: boolean;
}

interface ConsentDB extends DBSchema {
  consents: {
    key: [/* graphUrl */ string, /* type */ string, /* scope */ string];
    value: ConsentRecord;
    indexes: { 'by-type': ConsentRequest['type'], 'by-graph-url': string };
  };
}

const DB_NAME = 'consent-settings';
const DB_VERSION = 1;
const STORE_NAME = 'consents';

export class ConsentManager implements ConsentManagerInterface {

  #dbPromise: Promise<IDBPDatabase<ConsentDB>>;
  #requestConsentCallback: (request: ConsentRequest, uiType: ConsentUIType) => Promise<ConsentAction>;

  constructor(requestConsentCallback: (request: ConsentRequest, uiType: ConsentUIType) => Promise<ConsentAction>) {
    this.#requestConsentCallback = requestConsentCallback;
    this.#dbPromise = openDB<ConsentDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: ["graphUrl", "type", "scope"]
          });
          store.createIndex('by-type', 'type');
          store.createIndex('by-graph-url', 'graphUrl');
        }
      },
    });
  }

  #stringifyScope(scope: ConsentRequest['scope']): string {
    if (typeof scope === 'string') {
      return scope;
    }
    // Sort keys for consistent stringification
    return JSON.stringify(scope, Object.keys(scope).sort());
  }

  async setConsent(request: ConsentRequest, allow: boolean): Promise<void> {
    const db = await this.#dbPromise;
    const record: ConsentRecord = {
      graphUrl: request.graphUrl,
      type: request.type,
      scope: this.#stringifyScope(request.scope),
      allow,
    };
    await db.put(STORE_NAME, record);
  }

  async queryConsent(request: ConsentRequest, askUsingUiType?: ConsentUIType): Promise<boolean | undefined> {
    const db = await this.#dbPromise;
    const record = await db.get(STORE_NAME, [request.graphUrl, request.type, this.#stringifyScope(request.scope)]);
    let allow = record?.allow;
    if (allow === undefined && askUsingUiType) {
      const action = await this.#requestConsentCallback(request, askUsingUiType);
      switch (action) {
        case ConsentAction.ALLOW:
          allow = true;
          break;
        case ConsentAction.DENY:
          allow = false;
          break;
        case ConsentAction.ALWAYS_ALLOW:
          allow = true;
          await this.setConsent(request, true);
          break;
        case ConsentAction.ALWAYS_DENY:
          allow = false;
          await this.setConsent(request, false);
          break;
      }
    }
    return Boolean(allow);
  }

  async revokeConsent(request: ConsentRequest): Promise<void> {
    const db = await this.#dbPromise;
    await db.delete(STORE_NAME, [request.graphUrl, request.type, this.#stringifyScope(request.scope)]);
  }

  async getAllConsentsByType(
    type: ConsentRequest['type']
  ): Promise<ConsentRequest[]> {
    const db = await this.#dbPromise;
    const records = await db.getAllFromIndex(STORE_NAME, 'by-type', type);
    return records.map(r => ({ ...r, scope: JSON.parse(r.scope) })) as ConsentRequest[];
  }

  async clearAllConsents(): Promise<void> {
    const db = await this.#dbPromise;
    await db.clear(STORE_NAME);
  }
}
