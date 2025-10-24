/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MissingScopesTokenResult,
  SignedOutTokenResult,
  ValidTokenResult,
} from "./oauth.js";

export interface OpalShellProtocol {
  getSignInState(): Promise<SignInState>;

  validateScopes(): Promise<ValidateScopesResult>;

  fetchWithCreds: typeof fetch;

  generateSignInUrlAndNonce(
    // TODO(aomarks) Move OAuthScope to types
    scopes: string[]
  ): Promise<{ url: string; nonce: string }>;

  signOut(): Promise<void>;

  listenForSignIn(nonce: string): Promise<SignInResult>;

  // TODO(aomarks) Remove this method once shell migration is complete. Tokens
  // should not flow back into the iframe, but they temporarily do to allow for
  // incremental migration.
  getToken(
    scopes?: string[]
  ): Promise<
    ValidTokenResult | SignedOutTokenResult | MissingScopesTokenResult
  >;

  setUrl(url: string): void;

  pickDriveFiles(options: PickDriveFilesOptions): Promise<PickDriveFilesResult>;

  shareDriveFiles(options: ShareDriveFilesOptions): Promise<void>;

  checkAppAccess(): Promise<CheckAppAccessResult>;
}

export type SignInState =
  | { status: "signedout" }
  | {
      status: "signedin";
      id: string | undefined;
      domain: string | undefined;
      name: string | undefined;
      picture: string | undefined;
      scopes: string[];
    };

export type ValidateScopesResult = { ok: true } | { ok: false; error: string };

export type SignInResult =
  | { ok: true; state: SignInState }
  | { ok: false; error: SignInError };

export type SignInError =
  | { code: "missing-scopes"; missingScopes: string[] }
  | { code: "geo-restriction" }
  | { code: "user-cancelled" }
  | { code: "other"; userMessage: string };

export interface PickDriveFilesOptions {
  mimeTypes: string[];
}

export type PickDriveFilesResult =
  | { action: "picked"; docs: PickDriveFilesDocument[] }
  | { action: "cancel" }
  | { action: "error"; error: string };

export interface PickDriveFilesDocument {
  id: string;
  name?: string;
  mimeType?: string;
  resourceKey?: string;
}

export type CheckAppAccessResult = { canAccess: boolean };

export interface ShareDriveFilesOptions {
  fileIds: string[];
}
