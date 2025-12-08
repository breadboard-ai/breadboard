/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BreadboardMessage, EmbedderMessage } from "./embedder.js";

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// IMPORTANT! All interfaces and types defined here must use the `declare`
// keyword to prevent them from being renamed by Closure Compilier
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

export const SHELL_ORIGIN_URL_PARAMETER = "shellOrigin";

export const SHELL_ESTABLISH_MESSAGE_CHANNEL_REQUEST =
  "opal_shell_establish_message_channel_request";
export const SHELL_ESTABLISH_MESSAGE_CHANNEL_RESPONSE =
  "opal_shell_establish_message_channel_response";

export declare interface OpalShellHostProtocol {
  getSignInState(): Promise<SignInState>;

  // TODO(aomarks) Do this within getSignInState so that we don't need this
  // method.
  validateScopes(): Promise<ValidateScopesResult>;

  getConfiguration(): Promise<GuestConfiguration>;

  fetchWithCreds: typeof fetch;

  signIn(scopes: string[]): Promise<SignInResult>;

  signOut(): Promise<void>;

  setUrl(url: string): void;

  pickDriveFiles(options: PickDriveFilesOptions): Promise<PickDriveFilesResult>;

  shareDriveFiles(options: ShareDriveFilesOptions): Promise<void>;

  checkAppAccess(): Promise<CheckAppAccessResult>;

  sendToEmbedder(message: BreadboardMessage): Promise<void>;
}

export declare interface OpalShellGuestProtocol {
  receiveFromEmbedder(message: EmbedderMessage): Promise<void>;
}

export declare type SignInState =
  | { status: "signedout" }
  | {
      status: "signedin";
      id: string | undefined;
      domain: string | undefined;
      name: string | undefined;
      picture: string | undefined;
      scopes: string[];
    };

export declare type ValidateScopesResult = { ok: true } | { ok: false; error: string };

export declare type SignInResult =
  | { ok: true; state: SignInState }
  | { ok: false; error: SignInError };

export declare type SignInError =
  | { code: "missing-scopes"; missingScopes: string[] }
  | { code: "geo-restriction" }
  | { code: "user-cancelled" }
  | { code: "other"; userMessage: string };

export declare interface PickDriveFilesOptions {
  mimeTypes: string[];
}

export declare type PickDriveFilesResult =
  | { action: "picked"; docs: PickDriveFilesDocument[] }
  | { action: "cancel" }
  | { action: "error"; error: string };

export declare interface PickDriveFilesDocument {
  id: string;
  name?: string;
  mimeType?: string;
  resourceKey?: string;
}

export declare interface CheckAppAccessResult {
  canAccess: boolean;
}

export declare interface ShareDriveFilesOptions {
  fileIds: string[];
}

export declare type GuestConfiguration = {
  consentMessage: string;
  advancedEditorOrigin?: string;
  isTestApi?: boolean;
};