/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StringValue {
  /**
   * A data binding reference to a location in the data model (e.g., '/user/name').
   */
  path?: string;
  /**
   * A fixed, hardcoded string value.
   */
  literalString?: string;
}

export interface NumberValue {
  /**
   * A data binding reference to a location in the data model (e.g., '/user/name').
   */
  path?: string;
  /**
   * A fixed, hardcoded number value.
   */
  literalNumber?: number;
}

export interface BooleanValue {
  /**
   * A data binding reference to a location in the data model (e.g., '/user/name').
   */
  path?: string;
  /**
   * A fixed, hardcoded boolean value.
   */
  literalBoolean?: boolean;
}
