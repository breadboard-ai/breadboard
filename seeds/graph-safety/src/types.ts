/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Information flow control label values, i.e. levels of trust.
 *
 * This will become more complex over time, but for now, just a simple enum.
 * Flow is allowed from TRUSTED to TRUSTED, from either to UNTRUSTED,
 * but not from UNTRUSTED to TRUSTED.
 */
export enum SafetyLabelValue {
  UNTRUSTED,
  TRUSTED,
}
