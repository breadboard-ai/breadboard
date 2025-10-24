/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpalShellProtocol {
  getSignInState(): Promise<SignInState>;

  // TODO(aomarks) Do this within getSignInState so that we don't need this
  // method.
  validateScopes(): Promise<ValidateScopesResult>;

  fetchWithCreds: typeof fetch;

  generateSignInUrlAndNonce(
    scopes: string[]
  ): Promise<{ url: string; nonce: string }>;

  signOut(): Promise<void>;

  listenForSignIn(nonce: string): Promise<SignInResult>;

  setUrl(url: string): void;

  pickDriveFiles(options: PickDriveFilesOptions): Promise<PickDriveFilesResult>;

  shareDriveFiles(options: ShareDriveFilesOptions): Promise<void>;

  checkAppAccess(): Promise<CheckAppAccessResult>;
}

// TODO(aomarks) We should probably add some version checking for the handshake.
export interface OpalShellHandshakeRequest {
  type: "opal-shell-handshake-request";
}

export interface OpalShellHandshakeResponse {
  type: "opal-shell-handshake-response";
}

export function isOpalShellHandshakeRequest(
  value: unknown
): value is OpalShellHandshakeRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OpalShellHandshakeRequest>).type ===
      "opal-shell-handshake-request"
  );
}

export function isOpalShellHandshakeResponse(
  value: unknown
): value is OpalShellHandshakeResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OpalShellHandshakeResponse>).type ===
      "opal-shell-handshake-response"
  );
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
