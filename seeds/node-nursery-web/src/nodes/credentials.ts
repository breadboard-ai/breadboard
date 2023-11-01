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

const CREDENTIALS_KEY = "google:credentials:accessToken";

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

    let accessToken =
      globalThis.sessionStorage.getItem(CREDENTIALS_KEY) || undefined;
    if (!accessToken) {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      accessToken = credential?.accessToken;
      accessToken &&
        globalThis.sessionStorage.setItem(CREDENTIALS_KEY, accessToken);
    }
    return { accessToken };
  },
} satisfies NodeHandler;
