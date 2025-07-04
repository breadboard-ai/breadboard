/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kit, KitConstructor, NodeFactory } from "../types.js";

/**
 * Takes a kit constructor and creates a kit instance that can be used at
 * run-time.
 *
 * @param ctor Kit constructor
 * @returns A kit instance prepare for run-time use.
 */
export const asRuntimeKit = (ctor: KitConstructor<Kit>) => {
  return new ctor({
    create: () => {
      throw Error("Node instantiation can't (yet) happen during runtime");
    },
  } as unknown as NodeFactory);
};
