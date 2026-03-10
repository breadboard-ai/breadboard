/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extracts function declarations from TypeScript function-group modules
 * and writes them as Gemini API wire-format JSON into
 * packages/opal-backend/declarations/.
 *
 * Usage: npm run export-functions  (from packages/visual-editor)
 *
 * Excluded groups:
 * - a2ui: Generates dynamic layouts at runtime (async pipeline), not
 *   statically extractable.
 * - no-ui: Contains only an instruction, no function declarations.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECLARATIONS_DIR = resolve(
  __dirname,
  "../../opal-backend/opal_backend/declarations"
);

// Stub args — defineFunction eagerly converts Zod → JSON Schema during
// construction, so handlers are stored but never called at export time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STUB = null as any;

type FunctionMetadata = {
  name: string;
  icon?: string;
  title?: string;
};

type GroupResult = {
  declarations: unknown[];
  definitions: [string, { icon?: unknown; title?: string }][];
  instruction?: string;
};

type GroupExport = {
  name: string;
  getGroup: () => GroupResult;
};

async function loadGroups(): Promise<GroupExport[]> {
  // Import the configurator first to force correct ESM initialization
  // order across the function modules (system ↔ generate circular dep).
  await import("../dist/tsc/src/a2/agent/agent-function-configurator.js");

  const { getSystemFunctionGroup } = await import(
    "../dist/tsc/src/a2/agent/functions/system.js"
  );
  const { getGenerateFunctionGroup } = await import(
    "../dist/tsc/src/a2/agent/functions/generate.js"
  );
  const { getMemoryFunctionGroup } = await import(
    "../dist/tsc/src/a2/agent/functions/memory.js"
  );
  const { getChatFunctionGroup } = await import(
    "../dist/tsc/src/a2/agent/functions/chat.js"
  );
  const { getNotebookLMFunctionGroup } = await import(
    "../dist/tsc/src/a2/agent/functions/notebooklm.js"
  );
  const { getGoogleDriveFunctionGroup } = await import(
    "../dist/tsc/src/a2/agent/functions/google-drive.js"
  );

  return [
    {
      name: "system",
      getGroup: () =>
        getSystemFunctionGroup({
          fileSystem: STUB,
          translator: STUB,
          taskTreeManager: STUB,
          successCallback: STUB,
          failureCallback: STUB,
        }),
    },
    {
      name: "generate",
      getGroup: () =>
        getGenerateFunctionGroup({
          fileSystem: STUB,
          moduleArgs: STUB,
          translator: STUB,
          taskTreeManager: STUB,
          generators: STUB,
          sink: STUB,
        }),
    },
    {
      name: "memory",
      getGroup: () =>
        getMemoryFunctionGroup({
          context: STUB,
          translator: STUB,
          fileSystem: STUB,
          memoryManager: STUB,
          taskTreeManager: STUB,
        }),
    },
    {
      name: "chat",
      getGroup: () =>
        getChatFunctionGroup({
          chatManager: STUB,
          translator: STUB,
          taskTreeManager: STUB,
        }),
    },
    {
      name: "notebooklm",
      getGroup: () =>
        getNotebookLMFunctionGroup({
          notebookLmApiClient: STUB,
          taskTreeManager: STUB,
          fileSystem: STUB,
        }),
    },
    {
      name: "google-drive",
      getGroup: () =>
        getGoogleDriveFunctionGroup({
          moduleArgs: STUB,
          fileSystem: STUB,
        }),
    },
  ];
}

function extractMetadata(group: GroupResult): FunctionMetadata[] {
  return group.definitions.map(([name, def]) => {
    const entry: FunctionMetadata = { name };
    if (typeof def.icon === "string") {
      entry.icon = def.icon;
    }
    if (def.title) {
      entry.title = def.title;
    }
    return entry;
  });
}

async function main() {
  mkdirSync(DECLARATIONS_DIR, { recursive: true });

  const groups = await loadGroups();

  for (const { name, getGroup } of groups) {
    const group = getGroup();

    const declarations = group.declarations;
    const declarationsPath = resolve(
      DECLARATIONS_DIR,
      `${name}.functions.json`
    );
    writeFileSync(
      declarationsPath,
      JSON.stringify(declarations, null, 2) + "\n"
    );

    const metadata = extractMetadata(group);
    const metadataPath = resolve(DECLARATIONS_DIR, `${name}.metadata.json`);
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");

    if (group.instruction) {
      const instructionPath = resolve(
        DECLARATIONS_DIR,
        `${name}.instruction.md`
      );
      writeFileSync(instructionPath, group.instruction.trimStart() + "\n");
    }

    console.log(
      `✓ ${name}: ${declarations.length} declarations → ${declarationsPath}`
    );
    console.log(`  ${metadata.length} metadata entries → ${metadataPath}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
