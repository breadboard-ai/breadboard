/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { strIsFoo } from "./util.js";

export type Inputs = {
  str: string;
  opt?: string;
  numArr: number[];
  deepObj: { foo: { bar: string } };
};

export type Outputs = {
  bool: boolean;
  opt?: string;
};

export const run = ({ str }: Inputs): Outputs => {
  return { bool: strIsFoo(str) };
};
