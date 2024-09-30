/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, type ConvertBreadboardType } from "@breadboard-ai/build";

const strArr = array("string");
type StrArr = ConvertBreadboardType<typeof strArr>;

export type Inputs = {
  strArr: StrArr;
};

export type Outputs = {
  strArr: StrArr;
};

export const run = ({ strArr }: Inputs): Outputs => {
  return { strArr };
};
