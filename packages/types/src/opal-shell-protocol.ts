/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpalShellProtocol {
  generateSignInUrlAndNonce(scopes?: string[]): Promise<SignInUrlAndNonce>;
}

export interface SignInUrlAndNonce {
  url: string;
  nonce: string;
}
