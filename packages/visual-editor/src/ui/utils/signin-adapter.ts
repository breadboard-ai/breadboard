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
import { signal } from "signal-utils";

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
    this.#setStatePromise(this.#state);
  }

  #setStatePromise(state: Promise<SignInState>) {
    this.#state = state;
    state.then((value) => {
      if (this.#state === state) {
        this.stateSignal = value;
      }
    });
  }

  @signal
  accessor stateSignal: SignInState | undefined = undefined;

  get state() {
    return this.#state.then(({ status }) => status);
  }

  @signal
  get nameSignal() {
    return this.stateSignal?.status === "signedin"
      ? this.stateSignal.name
      : undefined;
  }

  get name() {
    return this.#state.then(() => this.nameSignal);
  }

  @signal
  get pictureSignal() {
    return this.stateSignal?.status === "signedin"
      ? this.stateSignal.picture
      : undefined;
  }

  get picture() {
    return this.#state.then(() => this.pictureSignal);
  }

  @signal
  get domainSignal() {
    return this.stateSignal?.status === "signedin"
      ? this.stateSignal.domain
      : undefined;
  }

  get domain() {
    return this.#state.then(() => this.domainSignal);
  }

  @signal
  get scopesSignal() {
    return this.stateSignal?.status === "signedin"
      ? new Set(this.stateSignal.scopes)
      : undefined;
  }

  get scopes(): Promise<Set<string> | undefined> {
    return this.#state.then(() => this.scopesSignal);
  }

  async signIn(scopes: OAuthScope[] = []): Promise<SignInResult> {
    const result = await this.#opalShell.signIn(scopes);
    if (result.ok) {
      this.#setStatePromise(Promise.resolve(result.state));
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
    this.#setStatePromise(Promise.resolve({ status: "signedout" }));
  }

  checkAppAccess(): Promise<CheckAppAccessResult> {
    return this.#opalShell.checkAppAccess();
  }

  validateScopes(): Promise<ValidateScopesResult> {
    return this.#opalShell.validateScopes();
  }
}
