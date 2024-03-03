/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { rollup } from "rollup";
import virtualDefault from "@rollup/plugin-virtual";
import nodeResolveDefault from "@rollup/plugin-node-resolve";
import commonjsDefault from "@rollup/plugin-commonjs";

import jsonDefault from "@rollup/plugin-json";

export type KitData =
  | {
      file: string;
      data: string;
    }
  | {
      file: string;
      url: string;
    };

const virtual = virtualDefault as unknown as typeof virtualDefault.default;
const nodeResolve =
  nodeResolveDefault as unknown as typeof nodeResolveDefault.default;
const json = jsonDefault as unknown as typeof jsonDefault.default;
const commonjs = commonjsDefault as unknown as typeof commonjsDefault.default;

const createUniqueName = async (url: string) => {
  const a = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(url));
  const uniqueName = Array.from(new Uint8Array(a))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return url.endsWith(".kit.json") ? `${uniqueName}.kit.json` : uniqueName;
};

/*
  This function compiles and bundles known 'node_module' into a single string.

  If the compilation fails, it will throw an error and halt the entire application.
*/
export const compile = async (file: string) => {
  console.log(`Compiling ${file}`);
  const bundle = await rollup({
    input: "entry",
    // Hide our sins like circular dependencies.
    logLevel: "silent",
    plugins: [
      virtual({
        entry: `import * as kit from "${file}"; export default kit.default;`,
      }),
      json(),
      commonjs(),
      nodeResolve(),
    ],
  });

  const { output } = await bundle.generate({ format: "es" });

  return output[0].code;
};

export const getKits = async (
  defaultKits: string[],
  specifiedKits: string[] = []
): Promise<KitData[]> => {
  const kitNames = [...new Set([...specifiedKits, ...defaultKits])];
  const kits = [];

  for (const kit of kitNames) {
    if (URL.canParse(kit)) {
      kits.push({
        file: await createUniqueName(kit),
        url: kit,
      });
    } else {
      kits.push({
        file: kit,
        data: await compile(kit),
      });
    }
  }

  return kits;
};
