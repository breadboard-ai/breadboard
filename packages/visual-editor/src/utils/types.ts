/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Result<T> =
  | {
      success: true;
      result: T;
    }
  | {
      success: false;
      error: string;
    };
