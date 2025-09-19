/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Result<R> =
  | {
      success: false;
      error: string;
    }
  | {
      success: true;
      result: R;
    };
