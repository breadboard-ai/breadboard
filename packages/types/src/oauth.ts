/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type GrantResponse =
  | { error: string }
  | {
      error?: undefined;
      access_token: string;
      expires_in: number;
      picture?: string;
      name?: string;
      id?: string;
      /**
       * Also known as the "hd" parameter, see
       * https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters
       */
      domain?: string;
      scopes?: string[];
    };
