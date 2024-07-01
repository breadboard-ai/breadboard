/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResourceReference } from ".";

export const isReference = (value: unknown): value is ResourceReference => {
  return (
    typeof value === "object" &&
    value !== null &&
    ("ref" in value || "reference" in value)
  );
};
