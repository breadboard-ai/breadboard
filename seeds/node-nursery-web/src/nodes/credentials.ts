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
  apiKey: string;
  authDomain: string;
  projectId: string;
  scopes: string[];
};

export type CredentialsOutputs = OutputValues & {
  accessToken: string;
};

export default {
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    const { apiKey, authDomain, projectId, scopes } =
      inputs as CredentialsInputs;
    initializeApp({ apiKey, authDomain, projectId });
    const provider = new GoogleAuthProvider();
    scopes.forEach((scope) => provider.addScope(scope));

    const auth = getAuth();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { accessToken: credential?.accessToken };
  },
} satisfies NodeHandler;
