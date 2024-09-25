/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoolArr } from "./util.js";

export type Inputs = {
  boolArr: BoolArr;
};

export type Outputs = {
  boolArr: BoolArr;
};

export const run = ({ boolArr }: Inputs): Outputs => {
  return { boolArr };
};
