/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ConnectionMode = "api_key" | "access_token";

export type ConnectionArgs =
  | {
      key: string | undefined;
    }
  | {
      token: string | undefined;
    };
