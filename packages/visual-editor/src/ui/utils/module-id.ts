/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function getModuleId() {
  let moduleId;

  do {
    moduleId = prompt("What would you like to call this module?");
    if (!moduleId) {
      return;
    }
    // Check that the new module name is valid.
  } while (!/^[A-Za-z0-9_\\-\\.]+$/gim.test(moduleId));

  return moduleId;
}
