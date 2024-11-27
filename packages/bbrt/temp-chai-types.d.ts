/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Temporary patch until https://github.com/esm-bundle/chai/pull/343 is merged
// and released
declare module "@esm-bundle/chai" {
  export {
    Assertion,
    AssertionError,
    assert,
    config,
    expect,
    should,
    use,
    util,
    version,
  } from "chai";
}
