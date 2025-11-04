import { openDB, DBSchema, IDBPDatabase } from 'idb';
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { ConsentAction } from "../state/types.js";

export type ConsentRequest = BreadboardUI.State.ConsentRequest;

interface ConsentRecord {
  graphId: string;
  type: ConsentRequest['type'];
  scope: string;
  allow: boolean;
}

interface ConsentDB extends DBSchema {
  consents: {
    key: [/* graphId */ string, /* type */ string, /* scope */ string];
    value: ConsentRecord;
    indexes: { 'by-type': ConsentRequest['type'], 'by-graph-id': string };
  };
}

const DB_NAME = 'consent-settings';
const DB_VERSION = 1;
const STORE_NAME = 'consents';

export class ConsentManager {

  #dbPromise: Promise<IDBPDatabase<ConsentDB>>;
  #requestConsentCallback: (request: ConsentRequest) => Promise<ConsentAction>;

  constructor(requestConsentCallback: (request: ConsentRequest) => Promise<ConsentAction>) {
    this.#requestConsentCallback = requestConsentCallback;
    this.#dbPromise = openDB<ConsentDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: ["graphId", "type", "scope"]
          });
          store.createIndex('by-type', 'type');
          store.createIndex('by-graph-id', 'graphId');
        }
      },
    });
  }

  private stringifyScope(scope: ConsentRequest['scope']): string {
    if (typeof scope === 'string') {
      return scope;
    }
    // Sort keys for consistent stringification
    return JSON.stringify(scope, Object.keys(scope).sort());
  }

  async setConsent(request: ConsentRequest, allow: boolean): Promise<void> {
    const db = await this.#dbPromise;
    const record: ConsentRecord = {
      graphId: request.graphId,
      type: request.type,
      scope: this.stringifyScope(request.scope),
      allow,
    };
    await db.put(STORE_NAME, record);
  }

  async queryConsent(request: ConsentRequest, askIfMissing: boolean): Promise<boolean | undefined> {
    const db = await this.#dbPromise;
    const record = await db.get(STORE_NAME, [request.graphId, request.type, this.stringifyScope(request.scope)]);
    let allow = record?.allow;
    if (allow === undefined && askIfMissing) {
      const action = await this.#requestConsentCallback(request);
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
    await db.delete(STORE_NAME, [request.graphId, request.type, this.stringifyScope(request.scope)]);
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
