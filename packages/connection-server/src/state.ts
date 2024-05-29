/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The OAuth "state" URL parameter is where you can put any arbitrary data which
 * will survive through the authentication request and back to the redirect URL.
 * We JSON-encode objects of this type into that URL parameter.
 */
export interface OurSpecialOAuthState {
  connection_id: string;
}
