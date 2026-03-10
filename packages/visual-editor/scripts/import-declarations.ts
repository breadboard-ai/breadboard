/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reads function declarations from opal-backend/declarations/ (the source
 * of truth) and generates TypeScript files in
 * src/a2/agent/functions/generated/.
 *
 * Each generated file exports:
 *   - declarations: FunctionDeclaration[]
 *   - metadata: Record<string, { icon?, title? }>
 *   - instruction: string | undefined
 *   - TypeScript interfaces for each function's params and response
 *
 * Usage: npm run import-declarations  (from packages/visual-editor)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECLARATIONS_DIR = resolve(
  __dirname,
  "../../opal-backend/opal_backend/declarations"
);
const GENERATED_DIR = resolve(
  __dirname,
  "../src/a2/agent/functions/generated"
);

// ---------------------------------------------------------------------------
// JSON Schema → TypeScript type generation
// ---------------------------------------------------------------------------

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  description?: string;
  default?: unknown;
  additionalProperties?: boolean;
  $schema?: string;
};

function jsonSchemaTypeToTs(schema: JsonSchema, indent: string): string {
  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  }

  switch (schema.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      if (schema.items) {
        const itemType = jsonSchemaTypeToTs(schema.items, indent);
        // Wrap complex types in parens for array syntax
        if (itemType.includes("|") || itemType.includes("{")) {
          return `(${itemType})[]`;
        }
        return `${itemType}[]`;
      }
      return "unknown[]";
    case "object":
      if (schema.properties) {
        return objectSchemaToTs(schema, indent);
      }
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

function objectSchemaToTs(schema: JsonSchema, indent: string): string {
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const innerIndent = indent + "  ";

  const lines = Object.entries(props).map(([name, propSchema]) => {
    const optional = required.has(name) ? "" : "?";
    const tsType = jsonSchemaTypeToTs(propSchema, innerIndent);
    return `${innerIndent}${name}${optional}: ${tsType};`;
  });

  return `{\n${lines.join("\n")}\n${indent}}`;
}

function toInterfaceName(functionName: string, suffix: string): string {
  // memory_create_sheet → MemoryCreateSheet
  const pascal = functionName
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return `${pascal}${suffix}`;
}

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------

type FunctionDeclaration = {
  name: string;
  description: string;
  parametersJsonSchema?: JsonSchema;
  responseJsonSchema?: JsonSchema;
};

type FunctionMetadataEntry = {
  name: string;
  icon?: string;
  title?: string;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function readTextFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function generateGroupFile(
  groupName: string,
  declarations: FunctionDeclaration[],
  metadata: FunctionMetadataEntry[],
  instruction: string | undefined
): string {
  const lines: string[] = [
    "/**",
    " * @license",
    " * Copyright 2026 Google LLC",
    " * SPDX-License-Identifier: Apache-2.0",
    " *",
    ` * AUTO-GENERATED from opal-backend/declarations/${groupName}.*`,
    " * Do not edit manually. Run: npm run import-declarations",
    " */",
    "",
    '/* eslint-disable */',
    "",
    'import type { FunctionDeclaration } from "../../../a2/gemini.js";',
    "",
  ];

  // Generate interfaces for each function's params and response
  for (const decl of declarations) {
    if (decl.parametersJsonSchema) {
      const paramsName = toInterfaceName(decl.name, "Params");
      lines.push(`export type ${paramsName} = ${objectSchemaToTs(decl.parametersJsonSchema, "")};`);
      lines.push("");
    }
    if (decl.responseJsonSchema) {
      const responseName = toInterfaceName(decl.name, "Response");
      lines.push(`export type ${responseName} = ${objectSchemaToTs(decl.responseJsonSchema, "")};`);
      lines.push("");
    }
  }

  // Export declarations array
  lines.push(
    `export const declarations: FunctionDeclaration[] = ${JSON.stringify(declarations, null, 2)};`
  );
  lines.push("");

  // Export metadata map
  const metadataMap: Record<string, { icon?: string; title?: string }> = {};
  for (const entry of metadata) {
    const val: { icon?: string; title?: string } = {};
    if (entry.icon) val.icon = entry.icon;
    if (entry.title) val.title = entry.title;
    metadataMap[entry.name] = val;
  }
  lines.push(
    `export const metadata: Record<string, { icon?: string; title?: string }> = ${JSON.stringify(metadataMap, null, 2)};`
  );
  lines.push("");

  // Export instruction
  if (instruction) {
    lines.push(
      `export const instruction: string = ${JSON.stringify(instruction.trimEnd())};`
    );
  } else {
    lines.push("export const instruction: string | undefined = undefined;");
  }
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function discoverGroups(): string[] {
  const files = readdirSync(DECLARATIONS_DIR);
  const groups = new Set<string>();
  for (const file of files) {
    const match = file.match(/^(.+)\.functions\.json$/);
    if (match) groups.add(match[1]);
  }
  return [...groups].sort();
}

function main() {
  mkdirSync(GENERATED_DIR, { recursive: true });

  const groups = discoverGroups();

  for (const groupName of groups) {
    const declarations = readJsonFile<FunctionDeclaration[]>(
      resolve(DECLARATIONS_DIR, `${groupName}.functions.json`)
    );
    const metadata = readJsonFile<FunctionMetadataEntry[]>(
      resolve(DECLARATIONS_DIR, `${groupName}.metadata.json`)
    );
    const instruction = readTextFile(
      resolve(DECLARATIONS_DIR, `${groupName}.instruction.md`)
    );

    const code = generateGroupFile(
      groupName,
      declarations,
      metadata,
      instruction
    );

    const outPath = resolve(GENERATED_DIR, `${groupName}.ts`);
    writeFileSync(outPath, code);

    console.log(
      `✓ ${groupName}: ${declarations.length} functions → ${outPath}`
    );
  }

  console.log("\nDone.");
}

main();
