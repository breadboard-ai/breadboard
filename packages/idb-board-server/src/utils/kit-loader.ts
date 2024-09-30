/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitConstructor, Kit, asRuntimeKit } from "@google-labs/breadboard";
import { load } from "@google-labs/breadboard/kits";

export const loadKits = async (kitConstructors: KitConstructor<Kit>[]) => {
  const loadedKits = kitConstructors.map((kitConstructor) =>
    asRuntimeKit(kitConstructor)
  );

  const base = new URL(`${self.location.origin}/kits.json`);
  const response = await fetch(base);
  const kitList = await response.json();

  const kits = await Promise.all(
    kitList.map(async (kitURL: string) => {
      // workaround for vite prod/dev mode difference
      if (kitURL.endsWith(".js") && import.meta.env.DEV) {
        kitURL = `/src/${kitURL.replace(/\.js$/, ".ts")}`;
      }
      return await load(new URL(kitURL, base));
    })
  );

  return [...loadedKits, ...kits];
};
