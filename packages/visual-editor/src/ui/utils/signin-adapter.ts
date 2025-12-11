/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type OAuthScope } from "../connection/oauth-scopes.js";
import { clearIdbGraphCache } from "../../board-server/user-graph-collection.js";
import type {
  CheckAppAccessResult,
  OpalShellHostProtocol,
  SignInResult,
  SignInState,
  ValidateScopesResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import type { SignInInfo } from "@breadboard-ai/types/sign-in-info.js";
import { createContext } from "@lit/context";

export const signinAdapterContext = createContext<SigninAdapter | undefined>(
  "SigninAdapter"
);

export class SigninAdapter implements SignInInfo {
  readonly #opalShell: OpalShellHostProtocol;
  #state: Promise<SignInState>;
  readonly fetchWithCreds: typeof globalThis.fetch;

  constructor(opalShell: OpalShellHostProtocol) {
    this.#opalShell = opalShell;
    this.fetchWithCreds = opalShell.fetchWithCreds.bind(opalShell);
    this.#state = opalShell.getSignInState();
  }

  get state() {
    return this.#state.then(({ status }) => status);
  }

  get name() {
    return this.#state.then((state) =>
      state.status === "signedin" ? state.name : undefined
    );
  }

  get picture() {
    return this.#state.then((state) =>
      state.status === "signedin" ? state.picture : undefined
    );
  }

  get domain() {
    return this.#state.then((state) =>
      state.status === "signedin" ? state.domain : undefined
    );
  }

  get scopes(): Promise<Set<string> | undefined> {
    return this.#state.then((state) =>
      state.status === "signedin" ? new Set(state.scopes) : undefined
    );
  }

  async signIn(scopes: OAuthScope[] = []): Promise<SignInResult> {
    const result = await this.#opalShell.signIn(scopes);
    if (result.ok) {
      this.#state = Promise.resolve(result.state);
    }
    return result;
  }

  async signOut(): Promise<void> {
    await Promise.all([
      this.#opalShell.signOut(),
      // Clear caches on signout because they contain user-specific data, like
      // the user's graphs, which we must not share across different signins.
      clearIdbGraphCache(),
      (async () =>
        Promise.all(
          (await globalThis.caches.keys()).map((key) =>
            globalThis.caches.delete(key)
          )
        ))(),
    ]);
    this.#state = Promise.resolve({ status: "signedout" });
  }

  checkAppAccess(): Promise<CheckAppAccessResult> {
    return this.#opalShell.checkAppAccess();
  }

  validateScopes(): Promise<ValidateScopesResult> {
    return this.#opalShell.validateScopes();
  }
}
