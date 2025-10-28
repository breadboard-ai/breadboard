/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SignInInfo {
  readonly state: "signedin" | "signedout";
  readonly name?: string;
  readonly picture?: string;
  readonly domain?: string;
}
