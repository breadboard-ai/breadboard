/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  InputValues,
  NodeHandler,
  OutputValues,
} from "@google-labs/breadboard";

export type CredentialsInputs = InputValues & {
  API_KEY: string;
  AUTH_DOMAIN: string;
  PROJECT_ID: string;
  scopes?: string[];
};

export type CredentialsOutputs = OutputValues & {
  accessToken: string;
};

type SessionStorage = {
  key: string;
  expires: number;
};

const STORE_DURATION = 1000 * 60 * 60; // 1 hour
const CREDENTIALS_KEY = "google:credentials:accessToken";

class Store {
  get(): string | undefined {
    const store = globalThis.sessionStorage.getItem(CREDENTIALS_KEY);
    if (!store) return undefined;
    const { key, expires } = JSON.parse(store) as SessionStorage;
    if (expires < Date.now()) return undefined;
    return key;
  }

  set(key?: string) {
    if (!key) return;
    const store: SessionStorage = {
      key,
      expires: Date.now() + STORE_DURATION,
    };
    globalThis.sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(store));
  }
}

export default {
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    const { API_KEY, AUTH_DOMAIN, PROJECT_ID, scopes } =
      inputs as CredentialsInputs;
    if (!API_KEY) throw "API Key is required to get credentials.";
    if (!AUTH_DOMAIN)
      throw "The domain for the popup is required to get credentials.";
    if (!PROJECT_ID) throw "The GCP project ID is required to get credentials.";
    initializeApp({
      apiKey: API_KEY,
      authDomain: AUTH_DOMAIN,
      projectId: PROJECT_ID,
    });

    const auth = getAuth();

    const provider = new GoogleAuthProvider();
    (scopes || []).forEach((scope) => provider.addScope(scope));

    const store = new Store();
    let accessToken = store.get();
    if (!accessToken) {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      accessToken = credential?.accessToken;
      store.set(accessToken);
    }
    return { accessToken };
  },
} satisfies NodeHandler;
