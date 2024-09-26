/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as esbuild from "esbuild";
import type { JSONSchema7 } from "json-schema";
import RefParser from "json-schema-ref-parser";
import { basename, relative } from "node:path";
import * as prettier from "prettier";
import * as tjs from "typescript-json-schema";
import type { Config } from "./config.js";

export async function generate(config: Config, inputPath: string) {
  const [code, schemas] = await Promise.all([
    bundleCode(inputPath),
    extractSchemas(inputPath, config.tsconfigPath),
  ]);
  const generated = generateSource(code, schemas, inputPath, config.outputDir);
  let formatted: string;
  try {
    formatted = await prettier.format(generated, { parser: "typescript" });
  } catch (e) {
    throw new AggregateError(
      [e],
      `Error from prettier while formatting ${inputPath}`
    );
  }
  return formatted;
}

async function bundleCode(inputPath: string): Promise<string> {
  const config: esbuild.BuildOptions = {
    entryPoints: [inputPath],
    // TODO(aomarks) We should use "esm" here, but runJavascript doesn't support
    // JS modules, so we need a legacy script instead, which iife gives us.
    format: "iife",
    bundle: true,
    write: false,
    legalComments: "inline",
  };
  let bundle;
  try {
    bundle = await esbuild.build(config);
  } catch (e) {
    throw new AggregateError(
      [e],
      `Error from esbuild with config ${JSON.stringify(config)}`
    );
  }
  for (const warning of bundle.warnings) {
    console.warn(
      `Warning from esbuild while bundling ${inputPath}: ` +
        `${JSON.stringify(warning)}`
    );
  }
  if (bundle.errors.length > 0) {
    throw new Error(
      `Error bundling file ${inputPath}: ${JSON.stringify(bundle.errors)}`
    );
  }
  if (bundle.outputFiles === undefined || bundle.outputFiles.length !== 1) {
    throw new Error(
      `Error bundling file ${inputPath}: ` +
        `Expected 1 output file, got ${bundle.outputFiles?.length ?? 0}.`
    );
  }
  // TODO(aomarks) Remove this once we support JS modules in runJavascript.
  // runJavascript does some regexp processing of the code which is broken with
  // the iife wrapper (convertToNamedFunction). We don't actually need the iife
  // wrapper since we run with an isolated scope, so we can just remove it. The
  // wrapper will be the first and last lines (actually second-to-last because
  // there's a trailing newline).
  const iifeWrapped = bundle.outputFiles[0]!.text;
  const lines = iifeWrapped.split("\n");
  const unwrapped =
    lines
      .slice(1, lines.length - 2)
      // Unindent.
      .map((line) => line.replace(/^ {2}/, ""))
      .join("\n") +
    // Add the trailing newline back.
    "\n";
  return unwrapped;
}

interface Schemas {
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
}

export async function extractSchemas(
  inputPath: string,
  tsconfigPath: string
): Promise<Schemas> {
  const tjsProgram = tjs.programFromConfig(tsconfigPath, [inputPath]);
  const tjsConfig: tjs.PartialArgs = {
    required: true,
    skipLibCheck: true,
  };
  let tjsGenerator;
  try {
    tjsGenerator = tjs.buildGenerator(tjsProgram, tjsConfig);
  } catch (e) {
    throw new AggregateError(
      [e],
      `Error from typescript-json-schema with config ${JSON.stringify(tjsConfig)}`
    );
  }
  if (tjsGenerator === null) {
    throw new Error("Generator is null");
  }

  let inputSchema = tjsGenerator.getSchemaForSymbol("Inputs") as
    | JSONSchema7
    | undefined;
  let outputSchema = tjsGenerator.getSchemaForSymbol("Outputs") as
    | JSONSchema7
    | undefined;

  if (inputSchema === undefined || outputSchema === undefined) {
    throw new Error("Expected exported types called Inputs and Outputs");
  }

  // json-schema-ref-parser has a bug where it incorrectly parses certain refs,
  // and then fails to look them up.
  simplifyRefNames(inputSchema);
  simplifyRefNames(outputSchema);

  // tjs generates $refs to refer to named types. To keep things simple, since
  // we don't have great support for $refs in Breadboard yet, inline them all.
  const refParserOptions: RefParser.Options = {
    dereference: {
      // Sometimes there are cycles in the schemas, and that's OK. In that case,
      // the "ignore" option means it will preserve circular $refs but inline
      // all the others.
      circular: "ignore",
    },
  };
  try {
    inputSchema = (await RefParser.default.dereference(
      inputSchema,
      refParserOptions
    )) as JSONSchema7;
  } catch (e) {
    throw new AggregateError(
      [e],
      `Error from json-schema-ref-parser with schema ${JSON.stringify(inputSchema)}`
    );
  }
  try {
    outputSchema = (await RefParser.default.dereference(
      outputSchema,
      refParserOptions
    )) as JSONSchema7;
  } catch (e) {
    throw new AggregateError(
      [e],
      `Error from json-schema-ref-parser with schema ${JSON.stringify(outputSchema)}`
    );
  }

  // A little cleanup.
  delete inputSchema["$schema"];
  delete outputSchema["$schema"];
  cleanUpDefinitions(inputSchema);
  cleanUpDefinitions(outputSchema);

  return { inputSchema, outputSchema };
}

function generateSource(
  bundledCode: string,
  { inputSchema, outputSchema }: Schemas,
  inputPath: string,
  outputDir: string
): string {
  const sourceImportSpecifier = relative(outputDir, inputPath).replace(
    /\.ts$/,
    ".js"
  );
  const functionName = kebabToCamel(basename(inputPath).replace(/\.ts/, ""));
  return `
    import {makeRunJavascriptComponent} from "./support.js";
    import type {Inputs, Outputs} from "${sourceImportSpecifier}";

    /**
     * This function was generated by @breadboard-ai/build-code from
     * ${relative(process.cwd(), inputPath)}
     */
    export const ${functionName} = makeRunJavascriptComponent<Inputs, Outputs>({
      code: \`${escapeForTemplateLiteral(escapeEscapeChars(bundledCode))}\`,
      inputSchema: ${JSON.stringify(inputSchema)},
      outputSchema: ${JSON.stringify(outputSchema)},
    });
  `;
}

function kebabToCamel(kebab: string): string {
  return kebab
    .toLowerCase()
    .replace(/[-_][a-z]/g, (group) => group.slice(-1).toUpperCase());
}

function escapeEscapeChars(str: string): string {
  return str.replace(/\\/g, "\\\\");
}

function escapeForTemplateLiteral(str: string): string {
  return str.replace(/`/g, "\\`").replace(/\${/g, "\\${");
}

const DEFINITIONS_PREFIX = "#/definitions/";

/**
 * Replace all $refs with a simple unique name.
 */
function simplifyRefNames(root: JSONSchema7) {
  if (root.definitions === undefined) {
    return;
  }

  const aliases = new Map<string, string>();
  let nextId = 0;

  for (const [oldName, def] of Object.entries(root.definitions)) {
    const newName = `def-${nextId++}`;
    aliases.set(DEFINITIONS_PREFIX + oldName, DEFINITIONS_PREFIX + newName);
    root.definitions[newName] = def;
    delete root.definitions[oldName];
  }
  if (aliases.size === 0) {
    return;
  }

  const visit = (schema: JSONSchema7) => {
    if (Array.isArray(schema)) {
      for (const item of schema) {
        visit(item);
      }
    } else if (typeof schema === "object" && schema !== null) {
      for (const val of Object.values(schema)) {
        visit(val);
      }
      if (schema.$ref !== undefined) {
        const alias = aliases.get(schema.$ref);
        if (alias !== undefined) {
          schema.$ref = alias;
        }
      }
    }
  };
  visit(root);
}

/**
 * Remove any `definitions` that aren't referenced in the schema, and then if
 * there are none left, remove `definitions` all together.
 */
function cleanUpDefinitions(root: JSONSchema7) {
  if (root.definitions === undefined) {
    return;
  }
  const usedRefs = new Set<string>();
  const visit = (schema: JSONSchema7) => {
    if (Array.isArray(schema)) {
      for (const item of schema) {
        visit(item);
      }
    } else if (typeof schema === "object" && schema !== null) {
      for (const val of Object.values(schema)) {
        visit(val);
      }
      if (schema.$ref !== undefined) {
        usedRefs.add(schema.$ref);
      }
    }
  };
  visit(root);
  for (const ref of Object.keys(root.definitions)) {
    if (!usedRefs.has(DEFINITIONS_PREFIX + ref)) {
      delete root.definitions[ref];
    }
  }
  if (Object.keys(root.definitions).length === 0) {
    delete root.definitions;
  }
}
